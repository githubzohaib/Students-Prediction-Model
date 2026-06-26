from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.prediction_route import router

import os

app = FastAPI()

origins = [
    "http://localhost:5173",
]

frontend = os.getenv("FRONTEND_URL")

if frontend:
    origins.append(frontend)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)