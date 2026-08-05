"""Student Performance Prediction API.

Serves the trained model zoo behind a documented REST surface: scoring,
exact-Shapley explanations, what-if simulation, batch roster scoring and
dataset analytics.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.ml_model import ArtifactsMissingError, registry
from routes.catalog_route import router as catalog_router
from routes.explain_route import router as explain_router
from routes.prediction_route import router as prediction_router
from routes.simulate_route import router as simulate_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
logger = logging.getLogger("spm.api")

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "https://students-prediction-model.vercel.app",
]


def allowed_origins() -> list[str]:
    origins = list(DEFAULT_ORIGINS)
    extra = os.getenv("FRONTEND_URL", "")
    for candidate in extra.split(","):
        candidate = candidate.strip()
        if candidate and candidate not in origins:
            origins.append(candidate)
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        registry.load()
        meta = registry.metadata
        logger.info(
            "Loaded %d models (champion=%s) trained on %s rows",
            len(meta["models"]), registry.champion_key, f"{meta['dataset']['rows']:,}",
        )
    except ArtifactsMissingError as exc:
        # The API still boots so /health can report *why* it is degraded.
        logger.error("Model artifacts unavailable: %s", exc)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Student Performance Prediction API",
    description=__doc__,
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ArtifactsMissingError)
async def artifacts_missing_handler(request: Request, exc: ArtifactsMissingError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": str(exc),
            "hint": "Artifacts are built, not committed. Locally: "
                    "`python model/train_model.py`. On Render this is the "
                    "build command (`... && python model/train_model.py --lite`) "
                    "-- check the build log.",
        },
    )


@app.api_route("/health", methods=["GET", "HEAD"], tags=["System"])
def health():
    if not registry.ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "reason": "Model artifacts not loaded.",
                "hint": "Training did not run. Locally: "
                        "`python model/train_model.py`; on Render, see the "
                        "build command in render.yaml.",
            },
        )

    meta = registry.metadata
    return {
        "status": "ok",
        "version": app.version,
        "champion": registry.champion_key,
        "models": registry.model_keys,
        "dataset_rows": meta["dataset"]["rows"],
        "trained_at": meta["generated_at"],
    }


app.include_router(prediction_router)
app.include_router(explain_router)
app.include_router(simulate_router)
app.include_router(catalog_router)
