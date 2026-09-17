import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  SITE_STATUS_LABEL,
  type ProjectStatus,
  type ProjectType,
  type SiteStatus,
} from "@/types/domain";

const TONE: Record<string, string> = {
  active: "border-eco/40 bg-eco/12 text-eco",
  monitoring: "border-primary/40 bg-primary/12 text-primary",
  planning: "border-violet/40 bg-violet/12 text-violet",
  completed: "border-border-strong bg-surface-raised/70 text-muted-foreground",
  archived: "border-border bg-surface/70 text-subtle-foreground",
};

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide",
        tone,
      )}
    >
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Pill tone={TONE[status] ?? TONE["archived"]!}>{PROJECT_STATUS_LABEL[status]}</Pill>;
}

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return <Pill tone={TONE[status] ?? TONE["archived"]!}>{SITE_STATUS_LABEL[status]}</Pill>;
}

export function ProjectTypeBadge({ type }: { type: ProjectType }) {
  const tone =
    type === "carbon"
      ? "border-primary/35 bg-primary/10 text-primary"
      : type === "biodiversity"
        ? "border-eco/35 bg-eco/10 text-eco"
        : "border-violet/35 bg-violet/10 text-violet";
  return <Pill tone={tone}>{PROJECT_TYPE_LABEL[type]}</Pill>;
}
