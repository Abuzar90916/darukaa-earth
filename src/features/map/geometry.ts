/**
 * Pure geometry helpers around the Mapbox drawing surface.
 *
 * These are deliberately free of Mapbox/WebGL so the polygon rules that guard
 * site persistence can be unit-tested in isolation from the renderer.
 */
import * as turf from "@turf/turf";

import type { PolygonGeometry } from "@/types/domain";

export type PolygonIssue =
  | "empty"
  | "wrong-type"
  | "malformed"
  | "too-few-points"
  | "not-closed"
  | "out-of-range"
  | "zero-area";

export interface PolygonValidation {
  valid: boolean;
  issue?: PolygonIssue;
  message?: string;
}

const MESSAGES: Record<PolygonIssue, string> = {
  empty: "Draw a boundary on the map before saving.",
  "wrong-type": "Only polygon boundaries can be saved as a site.",
  malformed: "That boundary is malformed. Please redraw it.",
  "too-few-points": "A boundary needs at least three distinct points.",
  "not-closed": "That boundary is not closed. Please redraw it.",
  "out-of-range": "Boundary coordinates are outside valid Earth bounds.",
  "zero-area": "That boundary has no measurable area. Please redraw it.",
};

function invalid(issue: PolygonIssue): PolygonValidation {
  return { valid: false, issue, message: MESSAGES[issue] };
}

/** Validates a GeoJSON polygon before it is sent to the geospatial API. */
export function validatePolygon(geometry: unknown): PolygonValidation {
  if (!geometry || typeof geometry !== "object") return invalid("empty");

  const geo = geometry as { type?: unknown; coordinates?: unknown };
  if (geo.type !== "Polygon") return invalid("wrong-type");
  if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) return invalid("empty");

  const ring = geo.coordinates[0];
  if (!Array.isArray(ring)) return invalid("malformed");

  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) return invalid("malformed");
    const [lng, lat] = point as number[];
    if (typeof lng !== "number" || typeof lat !== "number" || !isFinite(lng) || !isFinite(lat))
      return invalid("malformed");
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return invalid("out-of-range");
  }

  if (ring.length < 4) return invalid("too-few-points");

  const first = ring[0] as number[];
  const last = ring[ring.length - 1] as number[];
  if (first[0] !== last[0] || first[1] !== last[1]) return invalid("not-closed");

  const unique = new Set(
    (ring as number[][]).slice(0, -1).map((point) => `${point[0]},${point[1]}`),
  );
  if (unique.size < 3) return invalid("too-few-points");

  if (polygonAreaHectares(geometry as PolygonGeometry) <= 0) return invalid("zero-area");

  return { valid: true };
}

/** Spheroidal area of a polygon in hectares. */
export function polygonAreaHectares(geometry: PolygonGeometry): number {
  return turf.area(geometry as unknown as turf.AllGeoJSON) / 10_000;
}
