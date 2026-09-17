import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createProject,
  createSite,
  deleteProject,
  deleteSite,
  getProject,
  listProjects,
  listSiteMetrics,
  updateProject,
  updateSite,
} from "@/services/api";
import type { PolygonGeometry } from "@/types/domain";

const { supabase } = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

interface Result {
  data: unknown;
  error: { message: string } | null;
}

/** Chainable, thenable stand-in for a PostgREST query builder. */
function builder(result: Result) {
  const calls: Record<string, unknown[]> = {};
  const chain: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve),
    __calls: calls,
  };
  for (const method of ["select", "order", "eq", "gte", "insert", "update", "delete", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls[method] = args;
      return chain;
    };
  }
  for (const method of ["single", "maybeSingle"]) {
    chain[method] = () => Promise.resolve(result);
  }
  return chain;
}

function mockTable(result: Result) {
  const chain = builder(result);
  supabase.from.mockReturnValue(chain);
  return chain as unknown as { __calls: Record<string, unknown[]> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("projects", () => {
  it("lists projects newest first", async () => {
    const chain = mockTable({ data: [{ id: "p1" }, { id: "p2" }], error: null });
    const projects = await listProjects();
    expect(supabase.from).toHaveBeenCalledWith("projects");
    expect(chain.__calls["order"]).toEqual(["created_at", { ascending: false }]);
    expect(projects).toHaveLength(2);
  });

  it("surfaces a friendly error when the API fails", async () => {
    mockTable({ data: null, error: { message: "permission denied" } });
    await expect(listProjects()).rejects.toBeInstanceOf(ApiError);
    await expect(listProjects()).rejects.toThrow("We couldn't load your projects.");
  });

  it("reads a single project by id", async () => {
    const chain = mockTable({ data: { id: "p1", name: "Kaziranga" }, error: null });
    const project = await getProject("p1");
    expect(chain.__calls["eq"]).toEqual(["id", "p1"]);
    expect(project.name).toBe("Kaziranga");
  });

  it("throws when the project no longer exists", async () => {
    mockTable({ data: null, error: null });
    await expect(getProject("missing")).rejects.toThrow("This project no longer exists.");
  });

  it("stamps the signed-in user as creator on insert", async () => {
    const chain = mockTable({ data: { id: "p9" }, error: null });
    await createProject({ name: "New", type: "carbon" } as never);
    expect(chain.__calls["insert"]).toEqual([
      { name: "New", type: "carbon", created_by: "user-1" },
    ]);
  });

  it("refuses to create a project without a session", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    mockTable({ data: null, error: null });
    await expect(createProject({ name: "New" } as never)).rejects.toThrow(
      "Your session expired. Please sign in again.",
    );
  });

  it("updates a project by id", async () => {
    const chain = mockTable({ data: { id: "p1", name: "Renamed" }, error: null });
    const updated = await updateProject("p1", { name: "Renamed" } as never);
    expect(chain.__calls["update"]).toEqual([{ name: "Renamed" }]);
    expect(chain.__calls["eq"]).toEqual(["id", "p1"]);
    expect(updated.name).toBe("Renamed");
  });

  it("deletes a project and reports failures", async () => {
    const chain = mockTable({ data: null, error: null });
    await expect(deleteProject("p1")).resolves.toBeUndefined();
    expect(chain.__calls["eq"]).toEqual(["id", "p1"]);

    mockTable({ data: null, error: { message: "fk violation" } });
    await expect(deleteProject("p1")).rejects.toThrow("We couldn't delete this project.");
  });
});

describe("sites", () => {
  const geometry: PolygonGeometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0],
      ],
    ],
  };

  it("creates a site through the geospatial RPC with GeoJSON", async () => {
    supabase.rpc.mockResolvedValue({ data: "site-1", error: null });
    const id = await createSite({
      projectId: "p1",
      name: "Block A",
      status: "active" as never,
      geometry,
    });
    expect(id).toBe("site-1");
    expect(supabase.rpc).toHaveBeenCalledWith("create_site", {
      p_project_id: "p1",
      p_name: "Block A",
      p_description: "",
      p_status: "active",
      p_geojson: geometry,
    });
  });

  it("reports a boundary-specific error when the RPC rejects geometry", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "invalid geometry" } });
    await expect(
      createSite({ projectId: "p1", name: "Bad", status: "active" as never, geometry }),
    ).rejects.toThrow(/drawn boundary/i);
  });

  it("sends only the changed fields when updating a site", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await updateSite({ id: "s1", name: "Renamed" });
    expect(supabase.rpc).toHaveBeenCalledWith("update_site", {
      p_site_id: "s1",
      p_name: "Renamed",
    });
  });

  it("includes new geometry when the boundary is redrawn", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await updateSite({ id: "s1", geometry });
    expect(supabase.rpc.mock.calls[0]?.[1]).toMatchObject({ p_site_id: "s1", p_geojson: geometry });
  });

  it("does not send geometry when it is null", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await updateSite({ id: "s1", geometry: null });
    expect(supabase.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_geojson");
  });

  it("deletes a site and reports failures", async () => {
    const chain = mockTable({ data: null, error: null });
    await deleteSite("s1");
    expect(supabase.from).toHaveBeenCalledWith("sites");
    expect(chain.__calls["eq"]).toEqual(["id", "s1"]);

    mockTable({ data: null, error: { message: "denied" } });
    await expect(deleteSite("s1")).rejects.toThrow("We couldn't delete this site.");
  });
});

describe("metrics", () => {
  it("filters measurements by the selected time range", async () => {
    const chain = mockTable({ data: [{ id: "m1", site_id: "s1" }], error: null });
    await listSiteMetrics("s1", "30D");
    expect(chain.__calls["eq"]).toEqual(["site_id", "s1"]);
    expect(chain.__calls["gte"]?.[0]).toBe("recorded_at");
    expect(typeof chain.__calls["gte"]?.[1]).toBe("string");
  });

  it("does not apply a date filter for the full history range", async () => {
    const chain = mockTable({ data: [], error: null });
    await listSiteMetrics("s1", "ALL");
    expect(chain.__calls["gte"]).toBeUndefined();
  });

  it("returns an empty list rather than null", async () => {
    mockTable({ data: null, error: null });
    await expect(listSiteMetrics("s1", "ALL")).resolves.toEqual([]);
  });
});
