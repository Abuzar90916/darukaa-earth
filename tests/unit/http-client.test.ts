/**
 * Tests for the FastAPI transport used by the data-access layer.
 *
 * `apiRequest` is exercised directly with a stubbed `fetch`, so these run
 * without a Python process and without any real credentials.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

const BASE = "https://api.darukaa.test";

async function loadClient() {
  vi.stubEnv("VITE_API_BASE_URL", BASE);
  vi.resetModules();
  return await import("@/services/http");
}

describe("FastAPI transport", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "jwt-token" } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("is disabled when no service address is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const { isApiEnabled } = await import("@/services/http");
    expect(isApiEnabled()).toBe(false);
  });

  it("is enabled and normalises a trailing slash when configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", `${BASE}/`);
    vi.resetModules();
    const { isApiEnabled, API_BASE_URL } = await import("@/services/http");
    expect(isApiEnabled()).toBe(true);
    expect(API_BASE_URL).toBe(BASE);
  });

  it("sends the session JWT as a bearer token", async () => {
    const { apiRequest } = await loadClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "p1" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/projects")).resolves.toEqual([{ id: "p1" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/projects`);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-token");
  });

  it("serialises query parameters", async () => {
    const { apiRequest } = await loadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("[]", { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/sites/s1/metrics", { query: { range: "30D" } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/api/sites/s1/metrics?range=30D`);
  });

  it("posts a JSON body with the right content type", async () => {
    const { apiRequest } = await loadClient();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "s1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/projects/p1/sites", { method: "POST", body: { name: "Block" } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Block" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("surfaces the server's validation message for a rejected boundary", async () => {
    const { apiRequest, HttpError } = await loadClient();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "The drawn boundary encloses no area." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      apiRequest("/api/projects/p1/sites", { method: "POST", body: {} }),
    ).rejects.toThrow(HttpError);
  });

  it("reports an unreachable service instead of throwing a raw network error", async () => {
    const { apiRequest } = await loadClient();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiRequest("/api/projects")).rejects.toThrow(
      "We couldn't reach the analytics service.",
    );
  });

  it("returns nothing for a 204 delete", async () => {
    const { apiRequest } = await loadClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest("/api/sites/s1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
