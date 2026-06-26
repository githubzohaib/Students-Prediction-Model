from pathlib import Path
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "model" / "prediction_model.pkl"

print("Loading ML Model...")
model = joblib.load(MODEL_PATH)
print("Model Loaded Successfully")