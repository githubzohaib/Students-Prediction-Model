import { useState, ChangeEvent } from "react";
import { predictScore } from "../api/predictionApi";
import "./Prediction.css";

// If your API function isn't typed, you might need to define the return type here
interface PredictionResponse {
  predicted_score: number;
}

function Prediction(): JSX.Element {
  const [studyHours, setStudyHours] = useState<string>("");
  const [attendance, setAttendance] = useState<string>("");
  const [participation, setParticipation] = useState<string>("");
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handlePredict = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await predictScore({
        study_hours: Number(studyHours),
        attendance: Number(attendance),
        participation: Number(participation),
      }) as PredictionResponse; // Cast to our interface if predictionApi isn't strictly typed
      
      setResult(response.predicted_score);
    } catch (error) {
      console.error("Prediction failed", error);
    } finally {
      setLoading(false);
    }
  };

  // Strongly typed event handlers
  const handleStudyChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setStudyHours(e.target.value);
  };

  const handleAttendanceChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setAttendance(e.target.value);
  };

  const handleParticipationChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setParticipation(e.target.value);
  };

  // Check if form is valid to enable the button
  const isFormValid: boolean = 
    studyHours.trim() !== "" && 
    attendance.trim() !== "" && 
    participation.trim() !== "";

  return (
    <div className="prediction-wrapper">
      <div className="prediction-card">
        <div className="header">
          <h2>Student Score Prediction</h2>
          <p>Enter the details below to forecast the final score</p>
        </div>

        <div className="input-group">
          <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="number"
            placeholder="Study Hours (e.g., 5)"
            value={studyHours}
            onChange={handleStudyChange}
          />
        </div>

        <div className="input-group">
          <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="number"
            placeholder="Attendance % (e.g., 85)"
            value={attendance}
            onChange={handleAttendanceChange}
          />
        </div>

        <div className="input-group">
          <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="number"
            placeholder="Participation in Class (1-10)"
            value={participation}
            onChange={handleParticipationChange}
          />
        </div>

        <button 
          className="predict-btn" 
          onClick={handlePredict}
          disabled={loading || !isFormValid}
        >
          {loading ? (
            <span className="spinner"></span>
          ) : (
            "Predict Score"
          )}
        </button>

        {result !== null && (
          <div className="result-card">
            <span className="result-label">Predicted Score</span>
            <span className="result-value">{result}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Prediction;