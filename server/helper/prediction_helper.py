from config.ml_model import model
import numpy as np

def predict_score(study_hours, attendance, participation):

    if study_hours == 0 and attendance == 0 and participation == 0:
        return 0.0

    if attendance < 50:
        attendance = 50

    features = np.array([[
        study_hours,
        attendance,
        participation
    ]])

    prediction = model.predict(features)[0]

    prediction = max(0, min(100, prediction))

    return float(prediction)