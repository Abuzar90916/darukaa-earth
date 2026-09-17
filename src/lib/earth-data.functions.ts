import { createServerFn } from "@tanstack/react-start";

/**
 * Real reference data sources used to contextualise site measurements.
 * NOAA Global Monitoring Laboratory publishes the globally averaged marine
 * surface monthly mean CO2 series as a public CSV (no credentials needed).
 */
const NOAA_CO2_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.csv";

export interface Co2Point {
  /** ISO date for the month midpoint. */
  date: string;
  /** Globally averaged CO2 in parts per million. */
  ppm: number;
}

export const getGlobalCo2 = createServerFn({ method: "GET" }).handler(
  async (): Promise<Co2Point[]> => {
    const response = await fetch(NOAA_CO2_URL, {
      headers: { accept: "text/csv" },
    });
    if (!response.ok) throw new Error(`NOAA CO2 request failed: ${response.status}`);

    const text = await response.text();
    const points: Co2Point[] = [];

    for (const line of text.split("\n")) {
      const row = line.trim();
      if (!row || row.startsWith("#")) continue;
      const cells = row.split(",");
      if (cells.length < 4) continue;
      const year = Number(cells[0]);
      const month = Number(cells[1]);
      const ppm = Number(cells[3]);
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(ppm)) continue;
      points.push({
        date: new Date(Date.UTC(year, month - 1, 15)).toISOString(),
        ppm,
      });
    }

    // Last 15 years keeps the payload small while showing a clear trend.
    return points.slice(-180);
  },
);
