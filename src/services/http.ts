/**
 * Thin HTTP client for the FastAPI service.
 *
 * The service address comes from `VITE_API_BASE_URL`. When it is set, the
 * data-access layer in `services/api.ts` routes every project, site and
 * analytics operation through FastAPI; when it is not set, that layer falls
 * back to the direct database path so local development and the in-editor
 * preview keep working without a Python process running.
 *
 * Requests carry the session JWT as `Authorization: Bearer <token>`; FastAPI
 * verifies it against the same auth server that issued it, so there is exactly
 * one login flow.
 */
import { supabase } from "@/integrations/supabase/client";

export const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/+$/, "");

/** True when a FastAPI service address is configured. */
export function isApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function bearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    /* non-JSON error body */
  }
  return null;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/** Performs an authenticated call and returns the parsed JSON body. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await bearerToken();
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (cause) {
    throw new HttpError(0, "We couldn't reach the analytics service.");
  }

  if (!response.ok) {
    throw new HttpError(response.status, (await readErrorMessage(response)) ?? response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
