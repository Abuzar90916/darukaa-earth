import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cloud,
  Droplets,
  HeartPulse,
  Leaf,
  Loader2,
  PawPrint,
  Pencil,
  Ruler,
  Trash2,
  Trees,
} from "lucide-react";

import { GlassPanel } from "@/components/glass/GlassPanel";
import { StatCard } from "@/components/StatCard";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { ErrorState, LoadingState, PageSkeleton } from "@/components/States";
import { SiteStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MetricChart, TimeRangeSelector } from "@/features/analytics/MetricChart";
import type { DrawnPolygon } from "@/features/map/SiteMap";
import { formatArea, formatNumber } from "@/lib/format";
import { deleteSite, updateSite } from "@/services/api";
import { siteMetricsQuery, siteQuery } from "@/services/queries";
import { SITE_STATUS_LABEL, type SiteStatus, type TimeRange } from "@/types/domain";
import { toast } from "sonner";

const SiteMap = lazy(() => import("@/features/map/SiteMap"));

export const Route = createFileRoute("/_authenticated/sites/$siteId")({
  head: () => ({
    meta: [
      { title: "Site analytics — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Site intelligence: carbon sequestration, biodiversity index, forest cover and species count over time.",
      },
      { property: "og:title", content: "Site analytics — Darukaa.Earth" },
      { property: "og:description", content: "Measured change over time for a monitored site." },
    ],
  }),
  component: SiteAnalyticsPage,
});

function SiteAnalyticsPage() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<TimeRange>("1Y");
  const site = useQuery(siteQuery(siteId));
  const metrics = useQuery(siteMetricsQuery(siteId, range));

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SiteStatus>("active");
  const [polygon, setPolygon] = useState<DrawnPolygon | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      updateSite({
        id: siteId,
        name: name.trim(),
        status,
        ...(polygon ? { geometry: polygon.geometry } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Site updated");
      setEditOpen(false);
    },
    onError: () => toast.error("We couldn't save your changes to this site."),
  });

  const remove = useMutation({
    mutationFn: () => deleteSite(siteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Site deleted");
      navigate({ to: "/map" });
    },
    onError: () => toast.error("We couldn't delete this site."),
  });

  if (site.isPending) return <PageSkeleton label="Loading site intelligence" stats={3} />;
  if (site.isError)
    return <ErrorState message="We couldn't load this site." onRetry={() => void site.refetch()} />;

  const data = site.data;
  const rows = metrics.data ?? [];
  const newest = rows.at(-1);

  return (
    <div className="space-y-5">
      <Button variant="quiet" size="sm" asChild>
        <Link to="/projects/$projectId" params={{ projectId: data.project_id }}>
          <ArrowLeft aria-hidden className="size-4" /> {data.project_name}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="label-caps truncate">{data.project_name}</p>
            <DemoDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {data.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <SiteStatusBadge status={data.status} />
            <span className="num-tabular text-xs text-muted-foreground">
              <Ruler aria-hidden className="mr-1 inline size-3.5" />
              {formatArea(Number(data.area_hectares))}
            </span>
            <span className="text-xs text-subtle-foreground">
              {[data.region, data.country].filter(Boolean).join(", ") || "Location not set"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="quiet"
            onClick={() => {
              setName(data.name);
              setStatus(data.status);
              setPolygon(null);
              setEditOpen(true);
            }}
          >
            <Pencil aria-hidden className="size-4" /> Edit
          </Button>
          <Button variant="quiet" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden className="size-4 text-destructive" /> Delete
          </Button>
        </div>
      </div>

      <section
        aria-label="Latest measurements"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <StatCard
          label="Carbon sequestered"
          value={Number(newest?.carbon_sequestered ?? 0)}
          format={(n) => formatNumber(n, 0)}
          unit="tCO₂e"
          icon={<Cloud aria-hidden className="size-4" />}
          accent="eco"
        />
        <StatCard
          label="Biodiversity index"
          value={Number(newest?.biodiversity_index ?? 0)}
          format={(n) => n.toFixed(1)}
          unit="/ 100"
          icon={<Leaf aria-hidden className="size-4" />}
          accent="eco"
          delay={60}
        />
        <StatCard
          label="Forest cover"
          value={Number(newest?.forest_cover_percentage ?? 0)}
          format={(n) => n.toFixed(1)}
          unit="%"
          icon={<Trees aria-hidden className="size-4" />}
          accent="eco"
          delay={120}
        />
        <StatCard
          label="Species count"
          value={Number(newest?.species_count ?? 0)}
          format={(n) => formatNumber(Math.round(n))}
          icon={<PawPrint aria-hidden className="size-4" />}
          delay={180}
        />
        <StatCard
          label="Water quality"
          value={Number(newest?.water_quality_index ?? 0)}
          format={(n) => n.toFixed(1)}
          unit="/ 100"
          icon={<Droplets aria-hidden className="size-4" />}
          delay={240}
        />
        <StatCard
          label="Project health"
          value={Number(newest?.project_health_score ?? 0)}
          format={(n) => n.toFixed(1)}
          unit="/ 100"
          icon={<HeartPulse aria-hidden className="size-4" />}
          accent="violet"
          delay={300}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Performance over time
        </h2>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {metrics.isPending ? (
        <LoadingState label="Loading measurements…" />
      ) : metrics.isError ? (
        <ErrorState
          message="We couldn't load analytics for this site."
          onRetry={() => void metrics.refetch()}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <MetricChart
            title="Carbon sequestration"
            eyebrow="Cumulative"
            metrics={rows}
            field="carbon_sequestered"
            unit="tCO₂e"
            color="#38bdf8"
            digits={0}
          />
          <MetricChart
            title="Biodiversity index"
            eyebrow="Composite score"
            metrics={rows}
            field="biodiversity_index"
            unit="/ 100"
            color="#2dd4bf"
          />
          <MetricChart
            title="Forest cover"
            eyebrow="Canopy"
            metrics={rows}
            field="forest_cover_percentage"
            unit="%"
            color="#a3e635"
          />
          <MetricChart
            title="Species count"
            eyebrow="Observed"
            metrics={rows}
            field="species_count"
            color="#a78bfa"
            digits={0}
          />
        </div>
      )}

      <GlassPanel className="h-[20rem] overflow-hidden p-0">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Preparing the Earth view…
            </div>
          }
        >
          <SiteMap sites={[data]} selectedId={data.id} />
        </Suspense>
      </GlassPanel>

      {/* Edit dialog: name, status and an optional boundary redraw */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit site</DialogTitle>
            <DialogDescription>
              Adjust the details, or reshape the boundary on the map — the area is recalculated when
              you save.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Name</Label>
              <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SiteStatus)}>
                <SelectTrigger id="site-status">
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
          </div>

          <div className="h-64 overflow-hidden rounded-lg border border-border">
            {editOpen ? (
              <Suspense fallback={null}>
                <SiteMap
                  sites={[]}
                  drawing
                  initialPolygon={data.geometry}
                  onDrawChange={setPolygon}
                />
              </Suspense>
            ) : null}
          </div>
          <p className="num-tabular text-xs text-muted-foreground">
            Boundary area:{" "}
            {polygon
              ? `${polygon.areaHectares.toFixed(2)} ha`
              : `${Number(data.area_hectares).toFixed(2)} ha (unchanged)`}
          </p>

          <DialogFooter>
            <Button variant="quiet" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{data.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The boundary and every measurement recorded for this site will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
              Delete site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
