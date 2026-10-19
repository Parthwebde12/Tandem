import type { WorkItem } from "./types";

const TOKEN_KEY = "opsdesk_token";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  currentItem?: WorkItem;

  constructor(status: number, message: string, currentItem?: WorkItem) {
    super(message);
    this.status = status;
    this.currentItem = currentItem;
  }
}

const MAX_NETWORK_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries only when the request never got an answer (network error). Writes
// carry an Idempotency-Key, so repeating them cannot apply the change twice.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retry: boolean,
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (!retry || attempt >= MAX_NETWORK_ATTEMPTS) throw error;
      await sleep(400 * attempt);
    }
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";
  const isAuthEntry = path === "/auth/login" || path === "/auth/register";
  if (isWrite && !isAuthEntry && !headers.has("Idempotency-Key")) {
    // One key per user action; the same key is reused if the request is retried.
    headers.set("Idempotency-Key", crypto.randomUUID());
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = tokenStore.get();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetchWithRetry(
    `${API_BASE_URL}${path}`,
    { ...init, headers },
    isWrite && !isAuthEntry,
  );

  if (!response.ok) {
    let detail = response.statusText;
    let currentItem: WorkItem | undefined;
    const body = await response.json().catch(() => null);
    if (body && typeof body === "object" && "detail" in body) {
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (body.detail && typeof body.detail === "object") {
        if ("message" in body.detail && typeof body.detail.message === "string") {
          detail = body.detail.message;
        }
        if ("current_item" in body.detail) {
          currentItem = body.detail.current_item as WorkItem | undefined;
        }
      }
    }
    throw new ApiError(response.status, detail, currentItem);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}