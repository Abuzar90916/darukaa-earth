/** Domain types for Darukaa.Earth. Mirrors the PostGIS-backed schema. */

export type ProjectType = "carbon" | "biodiversity" | "carbon_and_biodiversity";
export type ProjectStatus = "planning" | "active" | "completed" | "archived";
export type SiteStatus = "planning" | "active" | "monitoring" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  country: string | null;
  region: string | null;
  total_area_hectares: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  country?: string | null;
  region?: string | null;
}

/** Polygon geometry in EPSG:4326 (WGS84 lon/lat). */
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

/** Row of the sites_geo view: site + GeoJSON geometry + parent project fields. */
export interface SiteGeo {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  area_hectares: number;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
  geometry: PolygonGeometry;
  centroid_lng: number;
  centroid_lat: number;
  project_name: string;
  project_type: ProjectType;
  project_status: ProjectStatus;
  country: string | null;
  region: string | null;
}

export interface SiteMetric {
  id: string;
  site_id: string;
  recorded_at: string;
  carbon_sequestered: number;
  biodiversity_index: number;
  forest_cover_percentage: number;
  species_count: number;
  water_quality_index: number;
  project_health_score: number;
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  carbon: "Carbon",
  biodiversity: "Biodiversity",
  carbon_and_biodiversity: "Carbon + Biodiversity",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  planning: "Planning",
  active: "Active",
  monitoring: "Monitoring",
  completed: "Completed",
  archived: "Archived",
};

export type TimeRange = "7D" | "30D" | "3M" | "6M" | "1Y" | "ALL";

export const TIME_RANGE_DAYS: Record<TimeRange, number | null> = {
  "7D": 7,
  "30D": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: null,
};
