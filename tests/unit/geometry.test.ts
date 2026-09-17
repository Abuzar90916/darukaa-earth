import { describe, expect, it } from "vitest";

import { polygonAreaHectares, validatePolygon } from "@/features/map/geometry";
import type { PolygonGeometry } from "@/types/domain";

/** ~1 km x ~1 km square near the equator (≈100 ha). */
const square: PolygonGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0.009, 0],
      [0.009, 0.009],
      [0, 0.009],
      [0, 0],
    ],
  ],
};

describe("validatePolygon", () => {
  it("accepts a closed, three-plus point polygon", () => {
    expect(validatePolygon(square)).toEqual({ valid: true });
  });

  it("rejects missing geometry", () => {
    expect(validatePolygon(null).issue).toBe("empty");
    expect(validatePolygon(undefined).issue).toBe("empty");
  });

  it("rejects an empty coordinate list", () => {
    expect(validatePolygon({ type: "Polygon", coordinates: [] }).issue).toBe("empty");
  });

  it("rejects non-polygon geometry types", () => {
    expect(validatePolygon({ type: "Point", coordinates: [0, 0] }).issue).toBe("wrong-type");
  });

  it("rejects malformed coordinate pairs", () => {
    expect(
      validatePolygon({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            ["x", 1],
            [1, 1],
            [0, 0],
          ],
        ],
      }).issue,
    ).toBe("malformed");
    expect(validatePolygon({ type: "Polygon", coordinates: [42] }).issue).toBe("malformed");
  });

  it("rejects coordinates outside Earth bounds", () => {
    expect(
      validatePolygon({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [200, 0],
            [200, 1],
            [0, 0],
          ],
        ],
      }).issue,
    ).toBe("out-of-range");
  });

  it("rejects a ring with fewer than three distinct points", () => {
    expect(
      validatePolygon({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }).issue,
    ).toBe("too-few-points");
  });

  it("rejects an unclosed ring", () => {
    expect(
      validatePolygon({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        ],
      }).issue,
    ).toBe("not-closed");
  });

  it("rejects a degenerate zero-area ring", () => {
    expect(
      validatePolygon({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 0],
          ],
        ],
      }).issue,
    ).toBe("zero-area");
  });

  it("returns a user-facing message with every failure", () => {
    const result = validatePolygon({ type: "LineString", coordinates: [] });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/polygon/i);
  });
});

describe("polygonAreaHectares", () => {
  it("computes spheroidal area in hectares", () => {
    const area = polygonAreaHectares(square);
    expect(area).toBeGreaterThan(90);
    expect(area).toBeLessThan(110);
  });

  it("scales with polygon size", () => {
    const bigger: PolygonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0.018, 0],
          [0.018, 0.018],
          [0, 0.018],
          [0, 0],
        ],
      ],
    };
    expect(polygonAreaHectares(bigger)).toBeGreaterThan(polygonAreaHectares(square) * 3.5);
  });
});
