/**
 * Centralised data-access layer.
 *
 * Every read/write goes through this module so components never talk to a
 * transport directly. There are two interchangeable transports:
 *
 *  1. **FastAPI** (`VITE_API_BASE_URL` set) — the production path:
 *     React -> FastAPI -> PostgreSQL/PostGIS. FastAPI verifies the session JWT,
 *     validates geometry, and stores boundaries as geometry(Polygon, 4326).
 *  2. **Direct Data API** (no `VITE_API_BASE_URL`) — the fallback used for local
 *     work and the in-editor preview, where no Python process is running. It
 *     hits the same database and the same PostGIS RPCs, under row-level security.
 *
 * Both transports return identical shapes, so components, hooks, charts and the
 * Mapbox layer are unaffected by which one is active.
 */
import { supabase } from "@/integrations/supabase/client";
import { apiRequest, HttpError, isApiEnabled } from "@/services/http";
import type {
  PolygonGeometry,
  Project,
  ProjectInput,
  SiteGeo,
  SiteMetric,
  SiteStatus,
  TimeRange,
} from "@/types/domain";
import { TIME_RANGE_DAYS } from "@/types/domain";

export class ApiError extends Error {}

function fail(message: string, error: { message: string } | null): never {
  console.error(message, error);
  throw new ApiError(message);
}

/**
 * Runs a FastAPI call and converts transport failures into friendly messages.
 * Validation problems (422) keep the server's own wording, which is what
 * explains a rejected polygon to the user.
 */
async function viaApi<T>(call: () => Promise<T>, friendly: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(friendly, error);
      if (error.status === 401) throw new ApiError("Your session expired. Please sign in again.");
      if (error.status === 422) throw new ApiError(error.message || friendly);
      if (error.status === 404) throw new ApiError("That record no longer exists.");
      throw new ApiError(friendly);
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ projects */

export async function listProjects(): Promise<Project[]> {
  if (isApiEnabled()) {
    return viaApi(() => apiRequest<Project[]>("/api/projects"), "We couldn't load your projects.");
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your projects.", error);
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<Project>(`/api/projects/${id}`),
      "We couldn't load this project.",
    );
  }
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) fail("We couldn't load this project.", error);
  if (!data) throw new ApiError("This project no longer exists.");
  return data as Project;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<Project>("/api/projects", { method: "POST", body: input }),
      "We couldn't create this project.",
    );
  }
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new ApiError("Your session expired. Please sign in again.");
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, created_by: uid })
    .select("*")
    .single();
  if (error) fail("We couldn't create this project.", error);
  return data as Project;
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<Project> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<Project>(`/api/projects/${id}`, { method: "PUT", body: input }),
      "We couldn't save your changes.",
    );
  }
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("We couldn't save your changes.", error);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  if (isApiEnabled()) {
    await viaApi(
      () => apiRequest<void>(`/api/projects/${id}`, { method: "DELETE" }),
      "We couldn't delete this project.",
    );
    return;
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) fail("We couldn't delete this project.", error);
}

/* --------------------------------------------------------------------- sites */

const SITE_COLUMNS =
  "id,project_id,name,description,area_hectares,status,created_at,updated_at,geometry,centroid_lng,centroid_lat,project_name,project_type,project_status,country,region";

export async function listSites(): Promise<SiteGeo[]> {
  if (isApiEnabled()) {
    return viaApi(() => apiRequest<SiteGeo[]>("/api/sites"), "We couldn't load your sites.");
  }
  const { data, error } = await supabase
    .from("sites_geo")
    .select(SITE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your sites.", error);
  return (data ?? []) as unknown as SiteGeo[];
}

export async function listProjectSites(projectId: string): Promise<SiteGeo[]> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<SiteGeo[]>(`/api/projects/${projectId}/sites`),
      "We couldn't load the sites for this project.",
    );
  }
  const { data, error } = await supabase
    .from("sites_geo")
    .select(SITE_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load the sites for this project.", error);
  return (data ?? []) as unknown as SiteGeo[];
}

export async function getSite(id: string): Promise<SiteGeo> {
  if (isApiEnabled()) {
    return viaApi(() => apiRequest<SiteGeo>(`/api/sites/${id}`), "We couldn't load this site.");
  }
  const { data, error } = await supabase
    .from("sites_geo")
    .select(SITE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("We couldn't load this site.", error);
  if (!data) throw new ApiError("This site no longer exists.");
  return data as unknown as SiteGeo;
}

export interface CreateSitePayload {
  projectId: string;
  name: string;
  description?: string | null;
  status: SiteStatus;
  geometry: PolygonGeometry;
}

/** Persists a boundary drawn on the map and returns the new site id. */
export async function createSite(payload: CreateSitePayload): Promise<string> {
  if (isApiEnabled()) {
    const site = await viaApi(
      () =>
        apiRequest<SiteGeo>(`/api/projects/${payload.projectId}/sites`, {
          method: "POST",
          body: {
            name: payload.name,
            description: payload.description ?? null,
            status: payload.status,
            geometry: payload.geometry,
          },
        }),
      "We couldn't save this site. Check the drawn boundary and try again.",
    );
    return site.id;
  }
  const { data, error } = await supabase.rpc("create_site", {
    p_project_id: payload.projectId,
    p_name: payload.name,
    p_description: payload.description ?? "",
    p_status: payload.status,
    p_geojson: payload.geometry as unknown as never,
  });
  if (error) fail("We couldn't save this site. Check the drawn boundary and try again.", error);
  return data as unknown as string;
}

export interface UpdateSitePayload {
  id: string;
  name?: string;
  description?: string | null;
  status?: SiteStatus;
  geometry?: PolygonGeometry | null;
}

export async function updateSite(payload: UpdateSitePayload): Promise<void> {
  if (isApiEnabled()) {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body["name"] = payload.name;
    if (payload.description !== undefined) body["description"] = payload.description;
    if (payload.status !== undefined) body["status"] = payload.status;
    if (payload.geometry) body["geometry"] = payload.geometry;
    await viaApi(
      () => apiRequest<SiteGeo>(`/api/sites/${payload.id}`, { method: "PUT", body }),
      "We couldn't save your changes to this site.",
    );
    return;
  }

  const args: Record<string, unknown> = { p_site_id: payload.id };
  if (payload.name !== undefined) args["p_name"] = payload.name;
  if (payload.description !== undefined) args["p_description"] = payload.description ?? "";
  if (payload.status !== undefined) args["p_status"] = payload.status;
  if (payload.geometry) args["p_geojson"] = payload.geometry;

  const { error } = await supabase.rpc("update_site", args as never);
  if (error) fail("We couldn't save your changes to this site.", error);
}

export async function deleteSite(id: string): Promise<void> {
  if (isApiEnabled()) {
    await viaApi(
      () => apiRequest<void>(`/api/sites/${id}`, { method: "DELETE" }),
      "We couldn't delete this site.",
    );
    return;
  }
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) fail("We couldn't delete this site.", error);
}

/* ------------------------------------------------------------------- metrics */

export async function listSiteMetrics(siteId: string, range: TimeRange): Promise<SiteMetric[]> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<SiteMetric[]>(`/api/sites/${siteId}/metrics`, { query: { range } }),
      "We couldn't load analytics for this site.",
    );
  }
  let query = supabase
    .from("site_metrics")
    .select("*")
    .eq("site_id", siteId)
    .order("recorded_at", { ascending: true });

  const days = TIME_RANGE_DAYS[range];
  if (days) {
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    query = query.gte("recorded_at", from);
  }

  const { data, error } = await query;
  if (error) fail("We couldn't load analytics for this site.", error);
  return (data ?? []) as SiteMetric[];
}

/** All recent measurement rows across the workspace (demo-scale volume). */
export async function listPortfolioMetrics(): Promise<SiteMetric[]> {
  if (isApiEnabled()) {
    return viaApi(
      () => apiRequest<SiteMetric[]>("/api/metrics", { query: { limit: 4000 } }),
      "We couldn't load the latest measurements.",
    );
  }
  const { data, error } = await supabase
    .from("site_metrics")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(4000);
  if (error) fail("We couldn't load the latest measurements.", error);
  return (data ?? []) as SiteMetric[];
}

/** Latest metric row per site, used for map/overview roll-ups. */
export async function listLatestMetrics(): Promise<Record<string, SiteMetric>> {
  const rows = await listPortfolioMetrics();
  const latest: Record<string, SiteMetric> = {};
  for (const row of rows) {
    if (!latest[row.site_id]) latest[row.site_id] = row;
  }
  return latest;
}

/**
 * Populates the workspace with the documented synthetic demonstration dataset.
 * This is a demo convenience that always runs against the database function.
 */
export async function seedDemoData(): Promise<number> {
  const { data, error } = await supabase.rpc("seed_demo_data");
  if (error) fail("We couldn't prepare the demonstration dataset.", error);
  return (data as unknown as number) ?? 0;
}
