import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score

current_dir = os.path.dirname(os.path.abspath(__file__))

csv_path = os.path.join(
    current_dir,
    "student_performance_1M.csv"
)

data = pd.read_csv(csv_path)

X = data[
    [
        "weekly_self_study_hours",
        "attendance_percentage",
        "class_participation"
    ]
]

y = data["total_score"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestRegressor(
    n_estimators=30,
    max_depth=10,
    min_samples_split=10,
    min_samples_leaf=5,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

predictions = model.predict(X_test)

print("R2 Score:", r2_score(y_test, predictions))

model_path = os.path.join(
    current_dir,
    "prediction_model.pkl"
)

joblib.dump(model, model_path)

print("Model Saved Successfully")
print("Saved At:", model_path)