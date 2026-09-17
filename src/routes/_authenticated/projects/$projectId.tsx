import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cloud,
  Leaf,
  MapPinned,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  Trees,
} from "lucide-react";

import { GlassPanel, PanelHeader } from "@/components/glass/GlassPanel";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ProjectStatusBadge, ProjectTypeBadge, SiteStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { formatArea, formatNumber, formatRelative } from "@/lib/format";
import { deleteSite } from "@/services/api";
import { latestMetricsQuery, projectQuery, projectSitesQuery } from "@/services/queries";
import type { SiteGeo } from "@/types/domain";
import { toast } from "sonner";

const SiteMap = lazy(() => import("@/features/map/SiteMap"));

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project detail — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Project detail: mapped sites, area under management, carbon, biodiversity and forest cover measurements.",
      },
      { property: "og:title", content: "Project detail — Darukaa.Earth" },
      { property: "og:description", content: "Mapped sites and measured change for this project." },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const project = useQuery(projectQuery(projectId));
  const sites = useQuery(projectSitesQuery(projectId));
  const latest = useQuery(latestMetricsQuery());

  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SiteGeo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const removeSite = useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Site deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("We couldn't delete this site."),
  });

  const roll = useMemo(() => {
    const rows = sites.data ?? [];
    const metrics = rows
      .map((s) => latest.data?.[s.id])
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    const avg = (pick: (m: (typeof metrics)[number]) => number) =>
      metrics.length ? metrics.reduce((sum, m) => sum + pick(m), 0) / metrics.length : 0;
    return {
      sites: rows.length,
      area: rows.reduce((sum, s) => sum + Number(s.area_hectares), 0),
      carbon: metrics.reduce((sum, m) => sum + Number(m.carbon_sequestered), 0),
      bio: avg((m) => Number(m.biodiversity_index)),
      forest: avg((m) => Number(m.forest_cover_percentage)),
    };
  }, [sites.data, latest.data]);

  if (project.isPending || sites.isPending) return <LoadingState label="Loading project…" />;
  if (project.isError)
    return (
      <ErrorState message="We couldn't load this project." onRetry={() => void project.refetch()} />
    );

  const rows = sites.data ?? [];

  return (
    <div className="space-y-5">
      <Button variant="quiet" size="sm" asChild>
        <Link to="/projects">
          <ArrowLeft aria-hidden className="size-4" /> All projects
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectTypeBadge type={project.data.project_type} />
            <ProjectStatusBadge status={project.data.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {project.data.name}
          </h1>
          <p className="mt-1 text-sm text-subtle-foreground">
            {[project.data.region, project.data.country].filter(Boolean).join(", ") ||
              "Location not set"}
          </p>
          {project.data.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {project.data.description}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="quiet" onClick={() => setEditOpen(true)}>
            <Pencil aria-hidden className="size-4" /> Edit
          </Button>
          <Button variant="hero" asChild>
            <Link to="/map" search={{ project: projectId, draw: true }}>
              <Plus aria-hidden className="size-4" /> Add site
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Project metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total sites"
          value={roll.sites}
          format={(n) => formatNumber(Math.round(n))}
          icon={<MapPinned aria-hidden className="size-4" />}
        />
        <StatCard
          label="Total area"
          value={roll.area}
          format={formatArea}
          icon={<Ruler aria-hidden className="size-4" />}
          accent="violet"
          delay={60}
        />
        <StatCard
          label="Carbon sequestered"
          value={roll.carbon}
          format={(n) => formatNumber(n, 0)}
          unit="tCO₂e"
          icon={<Cloud aria-hidden className="size-4" />}
          accent="eco"
          delay={120}
        />
        <StatCard
          label="Biodiversity index"
          value={roll.bio}
          format={(n) => n.toFixed(1)}
          unit="/ 100"
          icon={<Leaf aria-hidden className="size-4" />}
          accent="eco"
          delay={180}
        />
        <StatCard
          label="Forest cover"
          value={roll.forest}
          format={(n) => n.toFixed(1)}
          unit="%"
          icon={<Trees aria-hidden className="size-4" />}
          accent="eco"
          delay={240}
        />
      </section>

      <GlassPanel className="h-[22rem] overflow-hidden p-0 sm:h-[26rem]">
        {rows.length === 0 ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No sites mapped yet — draw the first boundary to see it here.
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Preparing the Earth view…
              </div>
            }
          >
            <SiteMap sites={rows} selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>
        )}
      </GlassPanel>

      <GlassPanel className="p-4 sm:p-5">
        <PanelHeader eyebrow="Mapped areas" title={`Sites (${rows.length})`} />
        {rows.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent"
            title="No sites mapped yet."
            description="Draw a boundary on the map to add the first site to this project."
            action={
              <Button variant="hero" asChild>
                <Link to="/map" search={{ project: projectId, draw: true }}>
                  Add site
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((site) => {
              const metric = latest.data?.[site.id];
              return (
                <li
                  key={site.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-3"
                >
                  <div className="min-w-[10rem] flex-1">
                    <Link
                      to="/sites/$siteId"
                      params={{ siteId: site.id }}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {site.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-subtle-foreground">
                      {formatArea(Number(site.area_hectares))} · updated{" "}
                      {formatRelative(site.updated_at)}
                    </p>
                  </div>
                  <span className="num-tabular text-xs text-muted-foreground">
                    {metric ? `${metric.biodiversity_index.toFixed(1)} bio` : "—"}
                  </span>
                  <span className="num-tabular text-xs text-muted-foreground">
                    {metric ? `${formatNumber(metric.carbon_sequestered, 0)} tCO₂e` : "—"}
                  </span>
                  <SiteStatusBadge status={site.status} />
                  <div className="flex gap-1">
                    <Button variant="quiet" size="sm" asChild>
                      <Link to="/sites/$siteId" params={{ siteId: site.id }}>
                        View
                      </Link>
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label={`Edit ${site.name}`}
                      onClick={() =>
                        navigate({ to: "/sites/$siteId", params: { siteId: site.id } })
                      }
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label={`Delete ${site.name}`}
                      onClick={() => setPendingDelete(site)}
                    >
                      <Trash2 aria-hidden className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project.data} />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The mapped boundary and its measurement history will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && removeSite.mutate(pendingDelete.id)}
              disabled={removeSite.isPending}
            >
              Delete site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
