import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000"
});

export const predictScore = async (
  payload: {
    study_hours: number;
    attendance: number;
    participation: number;
  }
) => {

  const response = await API.post(
    "/prediction/predict",
    payload
  );

  return response.data;
};