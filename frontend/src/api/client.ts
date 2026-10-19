import axios, { AxiosError } from "axios";

import { clearToken, getToken } from "@/auth/storage";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

/*
 * Session-expiry handling.
 *
 * The response interceptor runs outside React, so it cannot call useNavigate.
 * AuthProvider registers a handler here on mount and the interceptor calls it,
 * which keeps the redirect inside the router instead of doing a full page load.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** A 401 from these is a wrong password, not an expired session. */
const CREDENTIAL_ENDPOINTS = ["/auth/login", "/auth/register"];

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? "";
    const isCredentialCheck = CREDENTIAL_ENDPOINTS.some((path) => url.includes(path));

    if (error.response?.status === 401 && !isCredentialCheck) {
      // Token expired or was revoked mid-session: drop it and bounce to login.
      clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

type FastApiValidationIssue = { msg?: string; loc?: (string | number)[] };
type FastApiError = { detail?: string | FastApiValidationIssue[] };

/**
 * Turn an API failure into something worth showing a person.
 *
 * FastAPI sends `detail` as a string for HTTPException and as an array of
 * issues for a 422, and axios surfaces network failures with no response at
 * all. Callers should never render `error.message` directly.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (!error.response) {
    return "Cannot reach the server. Check that the API is running.";
  }

  const detail = (error.response.data as FastApiError | undefined)?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first?.msg) {
      const field = first.loc?.filter((part) => part !== "body").join(".");
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }

  if (error.response.status >= 500) {
    return "The server hit an error. Please try again.";
  }

  return fallback;
}
