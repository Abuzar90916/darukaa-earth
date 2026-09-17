/** Mapbox configuration. The public token is injected by the Mapbox connector. */
export const MAPBOX_TOKEN = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as
  string | undefined;

/** Dark basemap chosen to match the space/glass visual system of the platform. */
export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

/** Mapbox satellite raster tiles, toggled on top of the dark basemap. */
export const SATELLITE_TILES = "mapbox://mapbox.satellite";

export const SITE_COLORS = {
  carbon: "#38bdf8",
  biodiversity: "#2dd4bf",
  carbon_and_biodiversity: "#a78bfa",
} as const;
