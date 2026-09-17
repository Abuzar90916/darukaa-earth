import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, updateProject } from "@/services/api";
import { qk } from "@/services/queries";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type ProjectType,
} from "@/types/domain";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onCreated?: (project: Project) => void;
}

const EMPTY: ProjectInput = {
  name: "",
  description: "",
  project_type: "carbon",
  status: "planning",
  country: "",
  region: "",
};

export function ProjectFormDialog({ open, onOpenChange, project, onCreated }: Props) {
  const editing = Boolean(project);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      project
        ? {
            name: project.name,
            description: project.description ?? "",
            project_type: project.project_type,
            status: project.status,
            country: project.country ?? "",
            region: project.region ?? "",
          }
        : EMPTY,
    );
  }, [open, project]);

  const mutation = useMutation({
    mutationFn: async (input: ProjectInput) =>
      project ? updateProject(project.id, input) : createProject(input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: qk.projects });
      if (project) await queryClient.invalidateQueries({ queryKey: qk.project(project.id) });
      toast.success(editing ? "Project updated" : "Project created");
      onOpenChange(false);
      if (!editing) onCreated?.(saved);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Please try again."),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.name.trim().length < 3) {
      setError("Give the project a name of at least 3 characters.");
      return;
    }
    mutation.mutate({
      ...form,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      country: form.country?.trim() || null,
      region: form.region?.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            Projects group the sites you monitor. You can add mapped sites once it exists.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Western Ghats Restoration"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is being restored, measured or protected?"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-type">Type</Label>
              <Select
                value={form.project_type}
                onValueChange={(v) => setForm({ ...form, project_type: v as ProjectType })}
              >
                <SelectTrigger id="project-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}
              >
                <SelectTrigger id="project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-country">Country</Label>
              <Input
                id="project-country"
                value={form.country ?? ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="India"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-region">Region</Label>
              <Input
                id="project-region"
                value={form.region ?? ""}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="Karnataka"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
