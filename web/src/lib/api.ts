import type {
  ConfigPatch,
  ConfigResponse,
  DayResponse,
  Entry,
  Health,
  HistoryResponse,
  ImmichAlbum,
  Settings,
  SyncResult,
  TestImmichResult,
  TestVisionResult,
} from "./types";

/**
 * Thrown for any non-2xx response. `status` lets callers special-case 401/409.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Listeners notified whenever a request returns 401, so the app can bounce to login.
type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers:
        options.body != null
          ? { "Content-Type": "application/json", ...options.headers }
          : options.headers,
      ...options,
    });
  } catch {
    throw new ApiError(0, "Network error — is the server reachable?");
  }

  if (res.status === 401) {
    for (const h of unauthorizedHandlers) h();
    throw new ApiError(401, "auth");
  }

  let body: unknown = undefined;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const fromBody =
      body && typeof body === "object" && "error" in body
        ? String((body as Record<string, unknown>).error)
        : undefined;
    const msg = fromBody || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }

  return body as T;
}

export const api = {
  health: () => request<Health>("/api/health"),

  login: (password: string) =>
    request<unknown>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () => request<unknown>("/api/logout", { method: "POST" }),

  day: (date: string) =>
    request<DayResponse>(`/api/day?date=${encodeURIComponent(date)}`),

  sync: () => request<SyncResult>("/api/sync", { method: "POST" }),

  toggle: (id: Entry["id"]) =>
    request<{ included: boolean }>(`/api/entries/${id}/toggle`, {
      method: "POST",
    }),

  patch: (
    id: Entry["id"],
    patch: Partial<
      Pick<Entry, "dish" | "notes" | "kcal" | "protein_g" | "carbs_g" | "fat_g">
    >,
  ) =>
    request<Entry>(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  reanalyze: (id: Entry["id"], text?: string) =>
    request<Entry>(`/api/entries/${id}/reanalyze`, {
      method: "POST",
      body: JSON.stringify(text ? { text } : {}),
    }),

  chat: (id: Entry["id"], message: string) =>
    request<{ entry: Entry; reply: string }>(`/api/entries/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  remove: (id: Entry["id"]) =>
    request<{ ok: true }>(`/api/entries/${id}`, { method: "DELETE" }),

  getSettings: () => request<Settings>("/api/settings"),

  putSettings: (patch: Partial<Settings>) =>
    request<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  history: (days = 30) =>
    request<HistoryResponse>(`/api/history?days=${days}`),

  // --- v1.1: runtime config + setup wizard ---

  getConfig: () => request<ConfigResponse>("/api/config"),

  putConfig: (patch: ConfigPatch) =>
    request<ConfigResponse>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  testImmich: (input: { url?: string; api_key?: string }) =>
    request<TestImmichResult>("/api/config/test-immich", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  testVision: (input: {
    provider?: string;
    base_url?: string;
    api_key?: string;
    model?: string;
  }) =>
    request<TestVisionResult>("/api/config/test-vision", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  albums: () => request<ImmichAlbum[]>("/api/immich/albums"),
};

export function photoUrl(
  assetId: string,
  size: "thumbnail" | "preview" = "thumbnail",
): string {
  return `/api/photo/${encodeURIComponent(assetId)}?size=${size}`;
}
