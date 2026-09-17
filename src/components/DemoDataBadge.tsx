import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest provenance marker. The portfolio shipped with the platform is
 * generated, not measured in the field, and every screen that presents those
 * numbers says so.
 */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/50 px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-subtle-foreground",
        className,
      )}
      title="This portfolio is generated demonstration data, not field measurements."
    >
      <FlaskConical aria-hidden className="size-3 text-primary" />
      Demo data · synthetic
    </span>
  );
}
