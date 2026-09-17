import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MapPinned } from "lucide-react";

import { DemoDataBadge } from "@/components/DemoDataBadge";
import { GlassPanel, PanelHeader } from "@/components/glass/GlassPanel";
import { EmptyState, ErrorState, LoadingState, PageSkeleton } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlobalCo2Chart } from "@/features/analytics/GlobalCo2Chart";
import { MetricChart, TimeRangeSelector } from "@/features/analytics/MetricChart";
import { formatArea, formatNumber } from "@/lib/format";
import { latestMetricsQuery, siteMetricsQuery, sitesQuery } from "@/services/queries";
import type { TimeRange } from "@/types/domain";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Compare measured change across monitored sites: carbon, biodiversity, forest cover and species counts over time.",
      },
      { property: "og:title", content: "Analytics — Darukaa.Earth" },
      { property: "og:description", content: "Measured change across your monitored sites." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const sites = useQuery(sitesQuery());
  const latest = useQuery(latestMetricsQuery());
  const [siteId, setSiteId] = useState<string>("");
  const [range, setRange] = useState<TimeRange>("1Y");

  // Open on a site that actually has recorded history, so the first view is
  // never four empty charts.
  const defaultSiteId = useMemo(() => {
    const list = sites.data ?? [];
    const measured = list.find((s) => latest.data?.[s.id]);
    return measured?.id ?? list[0]?.id ?? "";
  }, [sites.data, latest.data]);

  const activeSiteId = siteId || defaultSiteId;
  const metrics = useQuery({
    ...siteMetricsQuery(activeSiteId, range),
    enabled: Boolean(activeSiteId),
  });

  const site = useMemo(
    () => (sites.data ?? []).find((s) => s.id === activeSiteId) ?? null,
    [sites.data, activeSiteId],
  );

  if (sites.isPending) return <PageSkeleton label="Loading analytics" stats={0} />;
  if (sites.isError) return <ErrorState onRetry={() => void sites.refetch()} />;

  if ((sites.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={<MapPinned aria-hidden className="size-5" />}
        title="No sites mapped yet."
        description="Analytics appear once a site has been mapped and measured."
        action={
          <Button variant="hero" asChild>
            <Link to="/map" search={{ draw: true }}>
              Add site
            </Link>
          </Button>
        }
      />
    );
  }

  const rows = metrics.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="label-caps">Intelligence</p>
            <DemoDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Measured change per site, drawn from the recorded measurement history.
          </p>
        </div>
        {site ? (
          <Button variant="glass" asChild>
            <Link to="/sites/$siteId" params={{ siteId: site.id }}>
              Open site <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-3">
        <Select value={activeSiteId} onValueChange={setSiteId}>
          <SelectTrigger className="w-full max-w-sm" aria-label="Select a site">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(sites.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} — {s.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TimeRangeSelector value={range} onChange={setRange} />
      </GlassPanel>

      {site ? (
        <GlassPanel className="p-4 sm:p-5">
          <PanelHeader
            eyebrow={site.project_name}
            title={site.name}
            action={
              <span className="num-tabular text-xs text-muted-foreground">
                {formatArea(Number(site.area_hectares))} · {formatNumber(rows.length)} measurements
              </span>
            }
          />
        </GlassPanel>
      ) : null}

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
            metrics={rows}
            field="carbon_sequestered"
            unit="tCO₂e"
            color="#38bdf8"
            digits={0}
          />
          <MetricChart
            title="Biodiversity index"
            metrics={rows}
            field="biodiversity_index"
            unit="/ 100"
            color="#2dd4bf"
          />
          <MetricChart
            title="Forest cover"
            metrics={rows}
            field="forest_cover_percentage"
            unit="%"
            color="#a3e635"
          />
          <MetricChart
            title="Project health"
            metrics={rows}
            field="project_health_score"
            unit="/ 100"
            color="#a78bfa"
          />
          <GlobalCo2Chart />
        </div>
      )}
    </div>
  );
}
