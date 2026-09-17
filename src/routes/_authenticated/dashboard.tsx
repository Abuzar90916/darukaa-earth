import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Cloud,
  Layers,
  Leaf,
  Loader2,
  MapPinned,
  Ruler,
  Sparkles,
  Trees,
  X,
} from "lucide-react";

import { DemoDataBadge } from "@/components/DemoDataBadge";
import { GlassPanel, PanelHeader } from "@/components/glass/GlassPanel";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { ProjectStatusBadge, ProjectTypeBadge, SiteStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatArea, formatNumber, formatRelative, trendPercent } from "@/lib/format";
import { seedDemoData } from "@/services/api";
import { latestMetricsQuery, projectsQuery, sitesQuery } from "@/services/queries";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { toast } from "sonner";

const SiteMap = lazy(() => import("@/features/map/SiteMap"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Portfolio overview of carbon and biodiversity projects: mapped sites, area under management and measured change.",
      },
      { property: "og:title", content: "Overview — Darukaa.Earth" },
      {
        property: "og:description",
        content: "Portfolio overview of carbon and biodiversity projects.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const projects = useQuery(projectsQuery());
  const sites = useQuery(sitesQuery());
  const latest = useQuery(latestMetricsQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seed = useMutation({
    mutationFn: seedDemoData,
    onSuccess: async (count) => {
      await queryClient.invalidateQueries();
      toast.success(`Demonstration dataset ready — ${count} projects added`);
    },
    onError: () => toast.error("We couldn't prepare the demonstration dataset."),
  });

  const seedRef = useRef(() => seed.mutate());
  seedRef.current = () => seed.mutate();

  const roll = useMemo(() => {
    const siteRows = sites.data ?? [];
    const projectRows = projects.data ?? [];
    const metrics = Object.values(latest.data ?? {});
    const average = (pick: (m: (typeof metrics)[number]) => number) =>
      metrics.length ? metrics.reduce((sum, m) => sum + pick(m), 0) / metrics.length : 0;
    return {
      totalProjects: projectRows.length,
      activeProjects: projectRows.filter((p) => p.status === "active").length,
      totalSites: siteRows.length,
      activeSites: siteRows.filter((s) => s.status === "active" || s.status === "monitoring")
        .length,
      totalArea: siteRows.reduce((sum, s) => sum + Number(s.area_hectares), 0),
      carbon: metrics.reduce((sum, m) => sum + Number(m.carbon_sequestered), 0),
      bio: average((m) => Number(m.biodiversity_index)),
      forest: average((m) => Number(m.forest_cover_percentage)),
      measured: metrics.length,
    };
  }, [projects.data, sites.data, latest.data]);

  // A brand-new workspace is populated once with the demonstration dataset,
  // so the platform is never empty on first sign-in.
  const seedStartedRef = useRef(false);
  const workspaceEmpty = !projects.isPending && (projects.data ?? []).length === 0;
  useEffect(() => {
    if (!workspaceEmpty || seedStartedRef.current) return;
    seedStartedRef.current = true;
    seedRef.current();
  }, [workspaceEmpty]);

  if (projects.isPending || sites.isPending || (workspaceEmpty && seed.isPending))
    return <PageSkeleton label="Loading your portfolio" showMap />;
  if (projects.isError) return <ErrorState onRetry={() => projects.refetch()} />;

  const projectRows = projects.data ?? [];
  const siteRows = sites.data ?? [];

  if (projectRows.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Layers aria-hidden className="size-5" />}
          title="Your Earth intelligence workspace is empty."
          description="Create your first project to start mapping sites and measuring change, or load the documented demonstration dataset."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="hero" onClick={() => setCreateOpen(true)}>
                Create your first project
              </Button>
              <Button variant="glass" onClick={() => seed.mutate()} disabled={seed.isPending}>
                {seed.isPending ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden className="size-4" />
                )}
                Load demonstration data
              </Button>
            </div>
          }
        />
        <ProjectFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(p) => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
        />
      </>
    );
  }

  const carbonSeries = Object.values(latest.data ?? {}).map((m) => Number(m.carbon_sequestered));
  const selected = siteRows.find((s) => s.id === selectedId) ?? null;
  const selectedMetric = selected ? latest.data?.[selected.id] : undefined;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="label-caps">Command centre</p>
            <DemoDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Portfolio overview
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Understand the Earth. Measure change. Protect what matters.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" asChild>
            <Link to="/map">
              <MapPinned aria-hidden className="size-4" /> Open map
            </Link>
          </Button>
          <Button variant="hero" onClick={() => setCreateOpen(true)}>
            New project
          </Button>
        </div>
      </div>

      {/* --------------------------------------- environmental overview line */}
      <GlassPanel className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <p className="label-caps">Environmental overview</p>
        <OverviewStat
          icon={<Leaf aria-hidden className="size-3.5 text-eco" />}
          label="Biodiversity index"
          value={`${roll.bio.toFixed(1)} / 100`}
        />
        <OverviewStat
          icon={<Trees aria-hidden className="size-3.5 text-eco" />}
          label="Forest cover"
          value={`${roll.forest.toFixed(1)}%`}
        />
        <OverviewStat
          icon={<Cloud aria-hidden className="size-3.5 text-primary" />}
          label="Sites measured"
          value={`${formatNumber(roll.measured)} of ${formatNumber(roll.totalSites)}`}
        />
      </GlassPanel>

      {/* ------------------------------------------------------------- KPIs */}
      <section aria-label="Summary statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active projects"
          value={roll.activeProjects}
          format={(n) => formatNumber(Math.round(n))}
          icon={<Layers aria-hidden className="size-4" />}
          hint={`of ${formatNumber(roll.totalProjects)} in the portfolio`}
          delay={0}
        />
        <StatCard
          label="Monitoring sites"
          value={roll.activeSites}
          format={(n) => formatNumber(Math.round(n))}
          icon={<MapPinned aria-hidden className="size-4" />}
          hint={`of ${formatNumber(roll.totalSites)} mapped boundaries`}
          delay={60}
        />
        <StatCard
          label="Area monitored"
          value={roll.totalArea}
          format={(n) => formatArea(n)}
          icon={<Ruler aria-hidden className="size-4" />}
          accent="violet"
          hint="Spheroidal area from mapped boundaries"
          delay={120}
        />
        <StatCard
          label="Carbon sequestered"
          value={roll.carbon}
          format={(n) => formatNumber(n, 0)}
          unit="tCO₂e"
          icon={<Cloud aria-hidden className="size-4" />}
          accent="eco"
          trend={trendPercent(carbonSeries)}
          delay={180}
        />
      </section>

      {/* ------------------------------------------------ map centrepiece */}
      <GlassPanel className="relative h-[24rem] overflow-hidden p-0 sm:h-[30rem] lg:h-[34rem]">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Preparing the Earth view…
            </div>
          }
        >
          <SiteMap sites={siteRows} selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end gap-3 p-3">
          <div className="pointer-events-auto glass hidden rounded-lg px-3 py-1.5 text-xs text-muted-foreground lg:block">
            {formatNumber(siteRows.length)} mapped {siteRows.length === 1 ? "site" : "sites"} ·{" "}
            {formatArea(roll.totalArea)}
          </div>
          <Button variant="glass" size="sm" className="pointer-events-auto" asChild>
            <Link to="/map">
              <span className="hidden sm:inline">Full map workspace</span>
              <span className="sm:hidden">Full map</span>
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>

        {selected ? (
          <div className="animate-drawer glass-strong absolute inset-x-3 bottom-3 rounded-xl p-4 sm:inset-x-auto sm:right-3 sm:w-80">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps truncate">{selected.project_name}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {selected.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close site summary"
                className="grid size-7 shrink-0 place-items-center rounded-md text-subtle-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/70 bg-surface/40 px-2.5 py-2">
                <dt className="text-subtle-foreground">Area</dt>
                <dd className="num-tabular mt-0.5 text-foreground">
                  {formatArea(Number(selected.area_hectares))}
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface/40 px-2.5 py-2">
                <dt className="text-subtle-foreground">Carbon</dt>
                <dd className="num-tabular mt-0.5 text-foreground">
                  {selectedMetric
                    ? `${formatNumber(Number(selectedMetric.carbon_sequestered), 0)} tCO₂e`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <SiteStatusBadge status={selected.status} />
              <Button variant="hero" size="sm" asChild>
                <Link to="/sites/$siteId" params={{ siteId: selected.id }}>
                  View analytics <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </GlassPanel>

      {/* -------------------------------------------- supporting information */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassPanel className="p-4 sm:p-5">
          <PanelHeader
            eyebrow="Portfolio"
            title="Projects"
            action={
              <Button variant="quiet" size="sm" asChild>
                <Link to="/projects">
                  View all <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </Button>
            }
          />
          <ul className="mt-3 divide-y divide-border">
            {projectRows.slice(0, 6).map((project) => {
              const count = siteRows.filter((s) => s.project_id === project.id).length;
              return (
                <li key={project.id}>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                      <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                        {[project.region, project.country].filter(Boolean).join(", ") ||
                          "Location not set"}{" "}
                        · {count} {count === 1 ? "site" : "sites"} ·{" "}
                        {formatArea(Number(project.total_area_hectares))}
                      </p>
                    </div>
                    <ProjectTypeBadge type={project.project_type} />
                    <ProjectStatusBadge status={project.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </GlassPanel>

        <GlassPanel className="p-4 sm:p-5">
          <PanelHeader eyebrow="Latest activity" title="Recently mapped sites" />
          {siteRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No sites mapped yet. Open the map to draw your first boundary.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {siteRows.slice(0, 6).map((site) => (
                <li key={site.id}>
                  <Link
                    to="/sites/$siteId"
                    params={{ siteId: site.id }}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{site.name}</p>
                      <p className="truncate text-xs text-subtle-foreground">
                        {site.project_name} · {formatArea(Number(site.area_hectares))} ·{" "}
                        {formatRelative(site.updated_at)}
                      </p>
                    </div>
                    <SiteStatusBadge status={site.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
      />
    </div>
  );
}

function OverviewStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-subtle-foreground">{label}</span>
      <span className="num-tabular text-foreground">{value}</span>
    </div>
  );
}
