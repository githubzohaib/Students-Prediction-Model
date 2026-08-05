"""Read-only endpoints describing the model zoo, the feature schema and the
dataset the models were trained on."""

from __future__ import annotations

from fastapi import APIRouter

from config.ml_model import registry
from schemas.prediction_schema import (
    FeatureSchemaEntry,
    ModelCatalogEntry,
    ModelCatalogResponse,
)

router = APIRouter(tags=["Catalog"])


@router.get("/model/catalog", response_model=ModelCatalogResponse,
            summary="All trained models with held-out metrics")
def catalog():
    meta = registry.metadata
    champion = registry.champion_key

    entries = [
        ModelCatalogEntry(
            key=record["key"],
            label=record["label"],
            family=record["family"],
            notes=record["notes"],
            is_champion=record["key"] == champion,
            supports_tree_interval=record["supports_tree_interval"],
            metrics=record["metrics"],
            hyperparameters=record["hyperparameters"],
        )
        for record in meta["models"]
    ]
    # Champion first, then by descending R2.
    entries.sort(key=lambda e: (not e.is_champion, -e.metrics["r2"]))

    return ModelCatalogResponse(
        models=entries,
        champion=champion,
        dataset=meta["dataset"],
        environment=meta["environment"],
        generated_at=meta["generated_at"],
        training_seconds=meta["training_seconds"],
    )


@router.get("/model/features", response_model=list[FeatureSchemaEntry],
            summary="Feature schema with cohort ranges for building input controls")
def features():
    return registry.features


@router.get("/model/grades", summary="Empirical grade bands recovered from the dataset")
def grades():
    return {
        "grades": registry.grades,
        "target": registry.metadata["target"],
    }


@router.get("/analytics/overview", summary="Dataset distributions, correlations and curves")
def analytics_overview():
    meta = registry.metadata
    return {
        "analytics": meta["analytics"],
        "features": meta["features"],
        "grades": meta["grades"],
        "target": meta["target"],
        "dataset": meta["dataset"],
        "signal_audit": meta["signal_audit"],
    }
