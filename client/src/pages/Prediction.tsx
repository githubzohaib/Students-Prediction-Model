import { useState } from "react";
import { predictScore } from "../api/predictionApi";

function Prediction() {

  const [studyHours, setStudyHours] =
    useState("");

  const [attendance, setAttendance] =
    useState("");

  const [participation, setParticipation] =
    useState("");

  const [result, setResult] =
    useState<number | null>(null);

  const handlePredict = async () => {

    const response =
      await predictScore({
        study_hours: Number(studyHours),
        attendance: Number(attendance),
        participation: Number(participation)
      });

    setResult(
      response.predicted_score
    );
  };

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "50px auto"
      }}
    >
      <h2>
        Student Score Prediction
      </h2>

      <input
        placeholder="Study Hours"
        value={studyHours}
        onChange={(e) =>
          setStudyHours(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        placeholder="Attendance %"
        value={attendance}
        onChange={(e) =>
          setAttendance(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <input
        placeholder="Participation"
        value={participation}
        onChange={(e) =>
          setParticipation(
            e.target.value
          )
        }
      />

      <br />
      <br />

      <button
        onClick={handlePredict}
      >
        Predict
      </button>

      {result && (
        <h3>
          Predicted Score:
          {" "}
          {result}
        </h3>
      )}
    </div>
  );
}

export default Prediction;