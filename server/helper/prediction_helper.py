import numpy as np

from config.ml_model import model

def predict_score(
    study_hours,
    attendance,
    participation
):

    features = np.array(
        [
            [
                study_hours,
                attendance,
                participation
            ]
        ]
    )

    prediction = model.predict(features)

    return float(
        prediction[0]
    )