import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Cloud,
  Leaf,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  Trees,
  X,
} from "lucide-react";

import { GlassPanel } from "@/components/glass/GlassPanel";
import { SiteStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DrawnPolygon } from "@/features/map/SiteMap";
import { formatArea, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createSite } from "@/services/api";
import { latestMetricsQuery, projectsQuery, sitesQuery } from "@/services/queries";
import {
  PROJECT_TYPE_LABEL,
  SITE_STATUS_LABEL,
  type ProjectType,
  type SiteStatus,
} from "@/types/domain";
import { toast } from "sonner";

const SiteMap = lazy(() => import("@/features/map/SiteMap"));

interface MapSearch {
  project?: string;
  site?: string;
  draw?: boolean;
}

export const Route = createFileRoute("/_authenticated/map")({
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    const out: MapSearch = {};
    if (typeof search["project"] === "string") out.project = search["project"];
    if (typeof search["site"] === "string") out.site = search["site"];
    if (search["draw"] === "1" || search["draw"] === true || search["draw"] === "true")
      out.draw = true;
    return out;
  },

  head: () => ({
    meta: [
      { title: "Map — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Explore every mapped site on a dark satellite basemap, draw new boundaries and inspect site intelligence.",
      },
      { property: "og:title", content: "Map — Darukaa.Earth" },
      { property: "og:description", content: "Geospatial view of every monitored site." },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projects = useQuery(projectsQuery());
  const sites = useQuery(sitesQuery());
  const latest = useQuery(latestMetricsQuery());

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.project ?? "all");
  const [typeFilter, setTypeFilter] = useState<ProjectType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<SiteStatus | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const [selectedId, setSelectedId] = useState<string | null>(searchParams.site ?? null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; key: string } | null>(null);

  // Add-site flow
  const [drawing, setDrawing] = useState(Boolean(searchParams.draw));
  const [drawProject, setDrawProject] = useState(searchParams.project ?? "");
  const [drawName, setDrawName] = useState("");
  const [drawStatus, setDrawStatus] = useState<SiteStatus>("planning");
  const [polygon, setPolygon] = useState<DrawnPolygon | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  const regions = useMemo(
    () =>
      Array.from(
        new Set((sites.data ?? []).map((s) => s.region).filter(Boolean) as string[]),
      ).sort(),
    [sites.data],
  );

  const visibleSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sites.data ?? []).filter((site) => {
      if (projectFilter !== "all" && site.project_id !== projectFilter) return false;
      if (typeFilter !== "all" && site.project_type !== typeFilter) return false;
      if (statusFilter !== "all" && site.status !== statusFilter) return false;
      if (regionFilter !== "all" && site.region !== regionFilter) return false;
      if (!q) return true;
      return [site.name, site.project_name, site.region, site.country]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [sites.data, query, projectFilter, typeFilter, statusFilter, regionFilter]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return visibleSites.slice(0, 6);
  }, [query, visibleSites]);

  const selected = (sites.data ?? []).find((s) => s.id === selectedId) ?? null;
  const selectedMetric = selected ? latest.data?.[selected.id] : undefined;

  const save = useMutation({
    mutationFn: async () => {
      if (!drawProject) throw new Error("Choose the project this site belongs to.");
      if (drawName.trim().length < 2) throw new Error("Give the site a name.");
      if (!polygon) throw new Error("Draw the site boundary on the map.");
      return createSite({
        projectId: drawProject,
        name: drawName.trim(),
        status: drawStatus,
        geometry: polygon.geometry,
      });
    },
    onSuccess: async (siteId) => {
      await queryClient.invalidateQueries();
      toast.success("Site saved with its boundary");
      resetDraw();
      setSelectedId(siteId);
    },
    onError: (err) => setDrawError(err instanceof Error ? err.message : "Please try again."),
  });

  function resetDraw() {
    setDrawing(false);
    setPolygon(null);
    setDrawName("");
    setDrawError(null);
    navigate({ to: "/map", search: {}, replace: true });
  }

  function selectSite(id: string) {
    setSelectedId(id);
    const site = (sites.data ?? []).find((s) => s.id === id);
    if (site)
      setFlyTo({ lng: site.centroid_lng, lat: site.centroid_lat, key: `${id}-${Date.now()}` });
  }

  const filtersActive =
    projectFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    regionFilter !== "all";

  return (
    <div className="relative h-[calc(100svh-6.25rem)] overflow-hidden rounded-xl border border-border">
      <Suspense
        fallback={
          <div className="grid h-full place-items-center">
            <p className="glass rounded-lg px-4 py-2 text-xs text-muted-foreground">
              Preparing the Earth view…
            </p>
          </div>
        }
      >
        <SiteMap
          sites={drawing ? [] : visibleSites}
          selectedId={selectedId}
          onSelect={selectSite}
          drawing={drawing}
          onDrawChange={setPolygon}
          flyTo={flyTo}
        />
      </Suspense>

      {/* search + filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="pointer-events-auto flex flex-wrap items-start gap-2">
          <GlassPanel tone="strong" className="relative min-w-[14rem] flex-1 max-w-md p-1.5">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sites, projects, regions"
                aria-label="Search sites and projects"
                className="h-10 w-full rounded-lg bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none"
              />
            </div>
            {searchResults.length > 0 ? (
              <ul className="mt-1 max-h-64 overflow-y-auto scrollbar-slim border-t border-border pt-1">
                {searchResults.map((site) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectSite(site.id);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        {site.name}
                        <span className="ml-1.5 text-xs text-subtle-foreground">
                          {site.project_name}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </GlassPanel>

          <Button
            variant="glass"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Filters
            {filtersActive ? (
              <span className="ml-1 size-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </Button>

          {!drawing ? (
            <Button variant="hero" onClick={() => setDrawing(true)}>
              <Plus aria-hidden className="size-4" /> Add site
            </Button>
          ) : null}
        </div>

        {showFilters ? (
          <GlassPanel
            tone="strong"
            className="pointer-events-auto mt-2 grid max-w-3xl gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="f-project">Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger id="f-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-type">Type</Label>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as ProjectType | "all")}
              >
                <SelectTrigger id="f-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(PROJECT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-status">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as SiteStatus | "all")}
              >
                <SelectTrigger id="f-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(SITE_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-region">Region</Label>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger id="f-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setProjectFilter("all");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setRegionFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </GlassPanel>
        ) : null}
      </div>

      {/* draw panel */}
      {drawing ? (
        <GlassPanel
          tone="strong"
          className="absolute inset-x-3 bottom-3 z-10 max-h-[76svh] overflow-y-auto scrollbar-slim p-4 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[22rem] animate-drawer"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps">New site</p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground">Draw the boundary</h2>
            </div>
            <Button variant="quiet" size="icon-sm" aria-label="Cancel" onClick={resetDraw}>
              <X aria-hidden className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="draw-project">
                <Step n={1} /> Project
              </Label>
              <Select value={drawProject} onValueChange={setDrawProject}>
                <SelectTrigger id="draw-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draw-name">
                <Step n={2} /> Site name
              </Label>
              <Input
                id="draw-name"
                value={drawName}
                onChange={(e) => setDrawName(e.target.value)}
                placeholder="North ridge parcel"
              />
              <p className="text-[0.6875rem] text-subtle-foreground">
                Use the name your field team will recognise.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draw-status">Status</Label>
              <Select value={drawStatus} onValueChange={(v) => setDrawStatus(v as SiteStatus)}>
                <SelectTrigger id="draw-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SITE_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 text-xs transition-colors",
                polygon ? "border-eco/40 bg-eco/8" : "border-dashed border-border bg-surface/40",
              )}
            >
              <p className="flex items-center gap-1.5 text-subtle-foreground">
                <Step n={3} /> Boundary area
              </p>
              <p className="num-tabular mt-1 text-base text-foreground">
                {polygon ? `${polygon.areaHectares.toFixed(2)} ha` : "Draw a polygon to measure"}
              </p>
              <p className="mt-1 text-[0.6875rem] text-subtle-foreground">
                {polygon
                  ? "Drag any point to refine the shape — the area updates instantly."
                  : "Use the polygon tool at the top-right of the map, then close the shape."}
              </p>
            </div>

            {drawError ? (
              <p role="alert" className="text-xs text-destructive">
                {drawError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button variant="quiet" className="flex-1" onClick={resetDraw}>
                Cancel
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={() => {
                  setDrawError(null);
                  save.mutate();
                }}
                disabled={save.isPending || !polygon || !drawProject || !drawName.trim()}
              >
                {save.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                Save site
              </Button>
            </div>
          </div>
        </GlassPanel>
      ) : null}

      {/* site details drawer */}
      {selected && !drawing ? (
        <GlassPanel
          tone="strong"
          role="region"
          aria-label={`Details for ${selected.name}`}
          className="absolute inset-x-3 bottom-3 z-10 max-h-[62svh] overflow-y-auto scrollbar-slim p-4 sm:inset-y-3 sm:inset-x-auto sm:right-3 sm:w-[22rem] sm:max-h-none animate-drawer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-caps truncate">{selected.project_name}</p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground">{selected.name}</h2>
              <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                {[selected.region, selected.country].filter(Boolean).join(", ") ||
                  "Location not set"}
              </p>
            </div>
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label="Close site details"
              onClick={() => setSelectedId(null)}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <SiteStatusBadge status={selected.status} />
            <span className="num-tabular text-xs text-muted-foreground">
              <Ruler aria-hidden className="mr-1 inline size-3.5" />
              {formatArea(Number(selected.area_hectares))}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Metric
              icon={<Cloud aria-hidden className="size-3.5" />}
              label="Carbon"
              value={
                selectedMetric ? `${formatNumber(selectedMetric.carbon_sequestered, 0)} tCO₂e` : "—"
              }
            />
            <Metric
              icon={<Leaf aria-hidden className="size-3.5" />}
              label="Biodiversity"
              value={selectedMetric ? selectedMetric.biodiversity_index.toFixed(1) : "—"}
            />
            <Metric
              icon={<Trees aria-hidden className="size-3.5" />}
              label="Forest cover"
              value={selectedMetric ? `${selectedMetric.forest_cover_percentage.toFixed(1)}%` : "—"}
            />
            <Metric
              icon={<MapPin aria-hidden className="size-3.5" />}
              label="Species"
              value={selectedMetric ? formatNumber(selectedMetric.species_count) : "—"}
            />
          </dl>

          {selectedMetric ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-subtle-foreground">Project health</span>
                <span className="num-tabular text-foreground">
                  {selectedMetric.project_health_score.toFixed(1)} / 100
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Project health score"
                aria-valuenow={Math.round(selectedMetric.project_health_score)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised"
              >
                <div
                  className="h-full rounded-full bg-eco/80 transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, selectedMetric.project_health_score))}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-subtle-foreground">
              No measurements recorded for this site yet.
            </p>
          )}

          <Button variant="hero" className="mt-4 w-full" asChild>
            <Link to="/sites/$siteId" params={{ siteId: selected.id }}>
              View full analytics <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </GlassPanel>
      ) : null}
    </div>
  );
}

/** Small numbered marker that turns the drawing form into a clear sequence. */
function Step({ n }: { n: number }) {
  return (
    <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full border border-primary/35 bg-primary/10 text-[0.5625rem] font-semibold text-primary">
      {n}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface/40 px-2.5 py-2">
      <dt className="flex items-center gap-1.5 text-subtle-foreground">
        {icon}
        {label}
      </dt>
      <dd className="num-tabular mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
