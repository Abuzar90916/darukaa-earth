import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { DemoDataBadge } from "@/components/DemoDataBadge";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { ProjectStatusBadge, ProjectTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectFormDialog } from "@/features/projects/ProjectFormDialog";
import { formatArea, formatDate, formatNumber } from "@/lib/format";
import { deleteProject } from "@/services/api";
import { projectsQuery, sitesQuery } from "@/services/queries";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectStatus,
  type ProjectType,
} from "@/types/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Create, review and manage carbon and biodiversity projects, their mapped sites and area under management.",
      },
      { property: "og:title", content: "Projects — Darukaa.Earth" },
      { property: "og:description", content: "Manage carbon and biodiversity projects." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery(projectsQuery());
  const sites = useQuery(sitesQuery());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [type, setType] = useState<ProjectType | "all">("all");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Project deleted");
      setPendingDelete(null);
    },
    onError: () => toast.error("We couldn't delete this project."),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects.data ?? []).filter((p) => {
      if (type !== "all" && p.project_type !== type) return false;
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      return [p.name, p.region, p.country, p.description]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [projects.data, search, type, status]);

  const siteCount = (projectId: string) =>
    (sites.data ?? []).filter((s) => s.project_id === projectId).length;

  if (projects.isPending) return <PageSkeleton label="Loading projects" stats={0} />;
  if (projects.isError) return <ErrorState onRetry={() => projects.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="label-caps">Portfolio</p>
            <DemoDataBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatNumber(rows.length)} of {formatNumber((projects.data ?? []).length)} projects ·{" "}
            {formatArea(rows.reduce((sum, p) => sum + Number(p.total_area_hectares), 0))} under
            management
          </p>
        </div>
        <Button
          variant="hero"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" /> New project
        </Button>
      </div>

      <GlassPanel className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, regions, countries"
            aria-label="Search projects"
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as ProjectType | "all")}>
          <SelectTrigger className="w-[11rem]" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(PROJECT_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus | "all")}>
          <SelectTrigger className="w-[9.5rem]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {search || type !== "all" || status !== "all" ? (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setSearch("");
              setType("all");
              setStatus("all");
            }}
          >
            Clear
          </Button>
        ) : null}
      </GlassPanel>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FolderOpen aria-hidden className="size-5" />}
          title={
            (projects.data ?? []).length === 0
              ? "Your Earth intelligence workspace is empty."
              : "No projects match these filters."
          }
          description={
            (projects.data ?? []).length === 0
              ? "Create your first project to start mapping sites and measuring change."
              : "Try a broader search or clear the filters."
          }
          action={
            (projects.data ?? []).length === 0 ? (
              <Button variant="hero" onClick={() => setFormOpen(true)}>
                Create your first project
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop: table. Mobile: the same rows as cards. */}
          <GlassPanel className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Projects with type, status, sites and area</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  {["Project", "Type", "Status", "Sites", "Total area", "Created", ""].map((h) => (
                    <th key={h} scope="col" className="label-caps px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((project) => (
                  <tr key={project.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: project.id }}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {project.name}
                      </Link>
                      <p className="text-xs text-subtle-foreground">
                        {[project.region, project.country].filter(Boolean).join(", ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <ProjectTypeBadge type={project.project_type} />
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                    <td className="num-tabular px-4 py-3 text-muted-foreground">
                      {siteCount(project.id)}
                    </td>
                    <td className="num-tabular px-4 py-3 text-muted-foreground">
                      {formatArea(Number(project.total_area_hectares))}
                    </td>
                    <td className="px-4 py-3 text-xs text-subtle-foreground">
                      {formatDate(project.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="quiet" size="sm" asChild>
                          <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                            Open
                          </Link>
                        </Button>
                        <Button
                          variant="quiet"
                          size="icon-sm"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => {
                            setEditing(project);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button
                          variant="quiet"
                          size="icon-sm"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setPendingDelete(project)}
                        >
                          <Trash2 aria-hidden className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>

          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((project) => (
              <li key={project.id}>
                <GlassPanel interactive className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className="min-w-0"
                    >
                      <p className="truncate font-medium text-foreground">{project.name}</p>
                      <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                        {[project.region, project.country].filter(Boolean).join(", ") || "—"}
                      </p>
                    </Link>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ProjectTypeBadge type={project.project_type} />
                    <span>{siteCount(project.id)} sites</span>
                    <span>{formatArea(Number(project.total_area_hectares))}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="glass" size="sm" className="flex-1" asChild>
                      <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                        Open
                      </Link>
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label={`Edit ${project.name}`}
                      onClick={() => {
                        setEditing(project);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon-sm"
                      aria-label={`Delete ${project.name}`}
                      onClick={() => setPendingDelete(project)}
                    >
                      <Trash2 aria-hidden className="size-4 text-destructive" />
                    </Button>
                  </div>
                </GlassPanel>
              </li>
            ))}
          </ul>
        </>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
        onCreated={(p) => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project along with its mapped sites and measurement history. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
