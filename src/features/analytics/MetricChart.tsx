import { useMemo } from "react";
import { LineChart } from "lucide-react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { GlassPanel, PanelHeader } from "@/components/glass/GlassPanel";
import { formatShortDate } from "@/lib/format";
import type { SiteMetric, TimeRange } from "@/types/domain";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

const RANGES: TimeRange[] = ["7D", "30D", "3M", "6M", "1Y", "ALL"];

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Select time range"
      className="glass flex items-center gap-0.5 rounded-lg p-1"
    >
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            value === range
              ? "bg-primary/20 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export interface MetricChartProps {
  title: string;
  eyebrow?: string;
  metrics: SiteMetric[];
  field: keyof Pick<
    SiteMetric,
    | "carbon_sequestered"
    | "biodiversity_index"
    | "forest_cover_percentage"
    | "species_count"
    | "water_quality_index"
    | "project_health_score"
  >;
  unit?: string;
  color?: string;
  digits?: number;
}

export function MetricChart({
  title,
  eyebrow,
  metrics,
  field,
  unit = "",
  color = "#38bdf8",
  digits = 1,
}: MetricChartProps) {
  const { data, options, summary } = useMemo(() => {
    const labels = metrics.map((m) => formatShortDate(m.recorded_at));
    const values = metrics.map((m) => Number(m[field]));

    const chartOptions: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#94a7c0", boxWidth: 10, boxHeight: 10, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: "rgba(9,17,33,0.94)",
          borderColor: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          titleColor: "#e6edf7",
          bodyColor: "#c3d0e2",
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${Number(ctx.parsed.y).toFixed(digits)}${unit ? ` ${unit}` : ""}`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Measurement date",
            color: "#7c8ea8",
            font: { size: 10 },
            padding: { top: 4 },
          },
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#7c8ea8", maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          title: {
            display: Boolean(unit),
            text: unit,
            color: "#7c8ea8",
            font: { size: 10 },
          },
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#7c8ea8", font: { size: 10 } },
        },
      },
      elements: { point: { radius: 0, hoverRadius: 4, hitRadius: 12 } },
    };

    const last = values.at(-1);
    const first = values[0];
    const change =
      typeof first === "number" && typeof last === "number" && first !== 0
        ? ((last - first) / Math.abs(first)) * 100
        : null;

    return {
      summary: { last, change },
      options: chartOptions,
      data: {
        labels,
        datasets: [
          {
            label: `${title}${unit ? ` (${unit})` : ""}`,
            data: values,
            borderColor: color,
            backgroundColor: (ctx: { chart: ChartJS }) => {
              const { ctx: c, chartArea } = ctx.chart;
              if (!chartArea) return "transparent";
              const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, `${color}55`);
              gradient.addColorStop(1, `${color}00`);
              return gradient;
            },
            borderWidth: 2,
            fill: true,
            tension: 0.35,
          },
        ],
      },
    };
  }, [metrics, field, title, unit, color, digits]);

  return (
    <GlassPanel className="p-4 sm:p-5">
      <PanelHeader
        eyebrow={eyebrow}
        title={title}
        action={
          typeof summary.change === "number" ? (
            <span
              className={cn(
                "num-tabular text-xs",
                summary.change >= 0 ? "text-eco" : "text-destructive",
              )}
            >
              {summary.change >= 0 ? "+" : ""}
              {summary.change.toFixed(1)}%
            </span>
          ) : null
        }
      />
      <p className="num-tabular mt-2 text-xl font-semibold text-foreground">
        {typeof summary.last === "number" ? summary.last.toFixed(digits) : "—"}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-subtle-foreground">{unit}</span>
        ) : null}
      </p>
      <div className="mt-3 h-52 sm:h-56">
        {metrics.length === 0 ? (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-border/70 bg-surface/20 px-4 text-center">
            <div>
              <LineChart aria-hidden className="mx-auto size-5 text-subtle-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">
                No measurements in this time range.
              </p>
              <p className="mt-1 text-[0.6875rem] text-subtle-foreground">
                Choose a longer range to see recorded history.
              </p>
            </div>
          </div>
        ) : (
          <Line
            data={data}
            options={options}
            aria-label={`${title} over time, ${metrics.length} measurements`}
          />
        )}
      </div>
    </GlassPanel>
  );
}
