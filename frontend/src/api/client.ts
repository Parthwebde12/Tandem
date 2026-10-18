import type { WorkItem } from "./types";

const TOKEN_KEY = "opsdesk_token";

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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = tokenStore.get();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (!response.ok) {
    let detail = response.statusText;
    let currentItem: WorkItem | undefined;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (body.detail && typeof body.detail === "object") {
        if (typeof body.detail.message === "string") {
          detail = body.detail.message;
        }
        currentItem = body.detail.current_item as WorkItem | undefined;
      }
    } catch {
      // body was not JSON; keep the status text
    }
    throw new ApiError(response.status, detail, currentItem);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}