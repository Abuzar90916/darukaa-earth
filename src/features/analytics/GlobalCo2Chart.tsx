import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";

import { GlassPanel, PanelHeader } from "@/components/glass/GlassPanel";
import { getGlobalCo2 } from "@/lib/earth-data.functions";

/**
 * Real atmospheric CO2 reference series (NOAA Global Monitoring Laboratory),
 * shown alongside site measurements for global context.
 */
export function GlobalCo2Chart() {
  const fetchCo2 = useServerFn(getGlobalCo2);
  const co2 = useQuery({
    queryKey: ["global-co2"],
    queryFn: () => fetchCo2(),
    staleTime: 12 * 60 * 60 * 1000,
  });

  const rows = co2.data ?? [];

  const data = useMemo(
    () => ({
      labels: rows.map((point) =>
        new Date(point.date).toLocaleDateString(undefined, { year: "numeric", month: "short" }),
      ),
      datasets: [
        {
          label: "Global mean CO₂ (ppm)",
          data: rows.map((point) => point.ppm),
          borderColor: "#fbbf24",
          backgroundColor: "rgba(251, 191, 36, 0.14)",
          borderWidth: 2,
          fill: true,
          pointRadius: 0,
          tension: 0.35,
        },
      ],
    }),
    [rows],
  );

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: "rgba(226,232,240,0.55)", maxTicksLimit: 6 },
        grid: { display: false },
      },
      y: {
        ticks: { color: "rgba(226,232,240,0.55)" },
        grid: { color: "rgba(148,163,184,0.12)" },
      },
    },
  };

  const latest = rows.at(-1);

  return (
    <GlassPanel className="p-4 sm:p-5">
      <PanelHeader
        eyebrow="Reference data · NOAA GML"
        title="Global atmospheric CO₂"
        action={
          latest ? (
            <span className="num-tabular text-xs text-muted-foreground">
              {latest.ppm.toFixed(1)} ppm
            </span>
          ) : null
        }
      />
      <div className="mt-3 h-[220px]">
        {co2.isPending ? (
          <p className="grid h-full place-items-center text-xs text-muted-foreground">
            Loading global reference series…
          </p>
        ) : co2.isError || rows.length === 0 ? (
          <p className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            The global CO₂ reference series is unavailable right now.
          </p>
        ) : (
          <Line data={data} options={options} />
        )}
      </div>
    </GlassPanel>
  );
}

export default GlobalCo2Chart;
