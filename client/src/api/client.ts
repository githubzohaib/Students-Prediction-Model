import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export const api = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/** Turn any axios failure into a message worth showing a user. */
export function describeError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }

  const axiosError = error as AxiosError<{ detail?: unknown; hint?: string }>;

  if (axiosError.code === "ECONNABORTED") {
    return "The request timed out. The API may be busy — try again.";
  }

  if (!axiosError.response) {
    return `Cannot reach the API at ${baseURL}. Is the server running?`;
  }

  const { status, data } = axiosError.response;
  const detail = data?.detail;

  // FastAPI validation errors arrive as an array of field descriptors.
  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: (string | number)[]; msg?: string } | undefined;
    if (first?.msg) {
      const field = first.loc?.filter((p) => p !== "body").join(".");
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }

  if (typeof detail === "string") {
    return data?.hint ? `${detail} ${data.hint}` : detail;
  }

  if (status === 503) {
    return "The model artifacts are not loaded. Run `python model/train_model.py` on the server.";
  }

  return `Request failed with status ${status}.`;
}

export { baseURL };
