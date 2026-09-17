import { memo, useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

import { polygonAreaHectares } from "./geometry";
import { MAPBOX_TOKEN, MAP_STYLE, SATELLITE_TILES } from "./mapbox";

import type { PolygonGeometry, SiteGeo } from "@/types/domain";
import { cn } from "@/lib/utils";

export interface DrawnPolygon {
  geometry: PolygonGeometry;
  areaHectares: number;
}

interface SiteMapProps {
  sites: SiteGeo[];
  selectedId?: string | null;
  onSelect?: (siteId: string) => void;
  /** Enables Mapbox Draw for creating or editing a boundary. */
  drawing?: boolean;
  /** Existing polygon loaded into the draw tool when editing. */
  initialPolygon?: PolygonGeometry | null;
  onDrawChange?: (polygon: DrawnPolygon | null) => void;
  /** Fly to this site whenever the value changes. */
  flyTo?: { lng: number; lat: number; zoom?: number; key: string } | null;
  className?: string;
}

function featureCollection(sites: SiteGeo[]) {
  return {
    type: "FeatureCollection" as const,
    features: sites.map((site) => ({
      type: "Feature" as const,
      id: site.id,
      geometry: site.geometry,
      properties: {
        id: site.id,
        name: site.name,
        project_type: site.project_type,
        status: site.status,
      },
    })),
  };
}

function SiteMapImpl({
  sites,
  selectedId = null,
  onSelect,
  drawing = false,
  initialPolygon = null,
  onDrawChange,
  flyTo = null,
  className,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const didFitRef = useRef(false);

  const emitDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || !onDrawChange) return;
    const collection = draw.getAll();
    const feature = collection.features.find((f) => f.geometry.type === "Polygon");
    if (!feature) {
      onDrawChange(null);
      return;
    }
    const geometry = feature.geometry as PolygonGeometry;
    // Spheroidal area in m² via turf, converted to hectares.
    const areaHectares = polygonAreaHectares(geometry);
    onDrawChange({ geometry, areaHectares });
  }, [onDrawChange]);

  /* ----------------------------------------------------------- init map */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    if (!MAPBOX_TOKEN) {
      setFailed("The map service isn't configured yet.");
      return undefined;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [78.9, 20.6],
      zoom: 3.1,
      attributionControl: false,
      projection: { name: "globe" },
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(6, 16, 31)",
        "high-color": "rgb(16, 38, 74)",
        "horizon-blend": 0.14,
        "space-color": "rgb(2, 8, 23)",
        "star-intensity": 0.18,
      });
    });

    map.on("load", () => {
      // Real satellite imagery, hidden until the viewer asks for it.
      map.addSource("satellite", { type: "raster", url: SATELLITE_TILES, tileSize: 256 });
      map.addLayer({
        id: "satellite-imagery",
        type: "raster",
        source: "satellite",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.92 },
      });

      map.addSource("sites", { type: "geojson", data: featureCollection([]) });

      map.addLayer({
        id: "sites-fill",
        type: "fill",
        source: "sites",
        paint: {
          "fill-color": [
            "match",
            ["get", "project_type"],
            "carbon",
            "#38bdf8",
            "biodiversity",
            "#2dd4bf",
            "#a78bfa",
          ],
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.34, 0.14],
        },
      });

      map.addLayer({
        id: "sites-line",
        type: "line",
        source: "sites",
        paint: {
          "line-color": [
            "match",
            ["get", "project_type"],
            "carbon",
            "#7dd3fc",
            "biodiversity",
            "#5eead4",
            "#c4b5fd",
          ],
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.6, 1.1],
          "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0.66],
          "line-blur": ["case", ["boolean", ["feature-state", "selected"], false], 1.4, 0],
        },
      });

      map.addLayer({
        id: "sites-label",
        type: "symbol",
        source: "sites",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#e2e8f0",
          "text-halo-color": "rgba(2,8,23,0.9)",
          "text-halo-width": 1.4,
        },
      });

      map.on("click", "sites-fill", (event) => {
        const id = event.features?.[0]?.properties?.["id"] as string | undefined;
        if (id) onSelect?.(id);
      });
      map.on("mouseenter", "sites-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sites-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      setReady(true);
    });

    map.on("error", (e) => {
      if (e.error?.message?.toLowerCase().includes("token")) {
        setFailed("The map couldn't authenticate. Check the Mapbox connection.");
      }
    });

    return () => {
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
      didFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------- site data */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("sites") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(featureCollection(sites));

    if (!didFitRef.current && sites.length > 0 && !drawing) {
      const bbox = turf.bbox(featureCollection(sites) as turf.AllGeoJSON) as [
        number,
        number,
        number,
        number,
      ];
      map.fitBounds(bbox, { padding: 90, duration: 1200, maxZoom: 11 });
      didFitRef.current = true;
    }
  }, [sites, ready, drawing]);

  /* ---------------------------------------------------------- selection */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const site of sites) {
      map.setFeatureState({ source: "sites", id: site.id }, { selected: site.id === selectedId });
    }
  }, [selectedId, sites, ready]);

  /* --------------------------------------------------- satellite imagery */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("satellite-imagery")) return;
    map.setLayoutProperty("satellite-imagery", "visibility", satellite ? "visible" : "none");
  }, [satellite, ready]);

  /* -------------------------------------------------------------- flyTo */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 11.5,
      duration: 1800,
      essential: true,
    });
  }, [flyTo?.key, flyTo, ready]);

  /* --------------------------------------------------------------- draw */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;

    if (!drawing) {
      if (drawRef.current) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
      return undefined;
    }

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: initialPolygon ? "simple_select" : "draw_polygon",
    });
    drawRef.current = draw;
    map.addControl(draw, "top-right");

    if (initialPolygon) {
      draw.add({
        type: "Feature",
        properties: {},
        geometry: initialPolygon,
      } as GeoJSON.Feature);
      const bbox = turf.bbox(initialPolygon as turf.AllGeoJSON) as [number, number, number, number];
      map.fitBounds(bbox, { padding: 120, duration: 900, maxZoom: 14 });
      emitDraw();
    }

    map.on("draw.create", emitDraw);
    map.on("draw.update", emitDraw);
    map.on("draw.delete", emitDraw);

    return () => {
      map.off("draw.create", emitDraw);
      map.off("draw.update", emitDraw);
      map.off("draw.delete", emitDraw);
      if (drawRef.current) {
        try {
          map.removeControl(drawRef.current);
        } catch {
          /* map already torn down */
        }
        drawRef.current = null;
      }
    };
  }, [drawing, ready, initialPolygon, emitDraw]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full" aria-label="Site map" role="application" />
      {ready ? (
        <button
          type="button"
          onClick={() => setSatellite((value) => !value)}
          aria-pressed={satellite}
          className="glass absolute bottom-[4.5rem] left-3 z-10 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {satellite ? "Basemap" : "Satellite imagery"}
        </button>
      ) : null}
      {!ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/40 backdrop-blur-sm">
          <p className="glass rounded-lg px-4 py-2 text-xs text-muted-foreground">
            Preparing the Earth view…
          </p>
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-6">
          <p className="glass max-w-sm rounded-lg px-4 py-3 text-center text-sm text-muted-foreground">
            {failed}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export const SiteMap = memo(SiteMapImpl);
export default SiteMap;
