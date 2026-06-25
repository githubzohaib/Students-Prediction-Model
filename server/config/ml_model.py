# config/ml_model.py

import joblib

print("Loading ML Model...")

model = joblib.load(
    "model/prediction_model.pkl"
)

print("Model Loaded Successfully")