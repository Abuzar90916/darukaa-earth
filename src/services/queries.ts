import { queryOptions } from "@tanstack/react-query";
import type { TimeRange } from "@/types/domain";
import {
  getProject,
  getSite,
  listLatestMetrics,
  listProjectSites,
  listProjects,
  listSiteMetrics,
  listSites,
} from "./api";

export const qk = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  sites: ["sites"] as const,
  projectSites: (id: string) => ["sites", "project", id] as const,
  site: (id: string) => ["sites", id] as const,
  metrics: (id: string, range: TimeRange) => ["metrics", id, range] as const,
  latestMetrics: ["metrics", "latest"] as const,
};

export const projectsQuery = () => queryOptions({ queryKey: qk.projects, queryFn: listProjects });

export const projectQuery = (id: string) =>
  queryOptions({ queryKey: qk.project(id), queryFn: () => getProject(id) });

export const sitesQuery = () => queryOptions({ queryKey: qk.sites, queryFn: listSites });

export const projectSitesQuery = (id: string) =>
  queryOptions({ queryKey: qk.projectSites(id), queryFn: () => listProjectSites(id) });

export const siteQuery = (id: string) =>
  queryOptions({ queryKey: qk.site(id), queryFn: () => getSite(id) });

export const siteMetricsQuery = (id: string, range: TimeRange) =>
  queryOptions({ queryKey: qk.metrics(id, range), queryFn: () => listSiteMetrics(id, range) });

export const latestMetricsQuery = () =>
  queryOptions({ queryKey: qk.latestMetrics, queryFn: listLatestMetrics });
