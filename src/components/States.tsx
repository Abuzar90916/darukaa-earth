import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center py-16", className)}
    >
      <GlassPanel className="flex items-center gap-3 px-5 py-3">
        <Loader2 aria-hidden className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{label}…</span>
      </GlassPanel>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-raised/60", className)} />;
}

/**
 * Structural placeholder that mirrors the page it replaces, so the layout
 * never jumps and the screen never looks broken while data arrives.
 */
export function PageSkeleton({
  label = "Loading",
  stats = 4,
  showMap = false,
}: {
  label?: string;
  stats?: number;
  showMap?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{label}…</span>
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-8 w-64" />
      </div>
      {stats > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[6.5rem]" />
          ))}
        </div>
      ) : null}
      {showMap ? <SkeletonBlock className="h-[22rem] lg:h-[30rem]" /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-56" />
        <SkeletonBlock className="h-56" />
      </div>
    </div>
  );
}

export function ErrorState({
  message = "We couldn't load this right now.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <GlassPanel className="mx-auto max-w-md p-8 text-center">
      <TriangleAlert aria-hidden className="mx-auto mb-3 size-6 text-warning" />
      <p className="text-sm text-foreground">{message}</p>
      <p className="mt-1 text-xs text-subtle-foreground">
        Check your connection — your data is safe.
      </p>
      {onRetry ? (
        <Button variant="glass" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </GlassPanel>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <GlassPanel className={cn("mx-auto max-w-lg px-8 py-12 text-center animate-rise", className)}>
      {icon ? (
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full border border-primary/25 bg-primary/8 text-primary">
          {icon}
        </div>
      ) : null}

      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </GlassPanel>
  );
}
