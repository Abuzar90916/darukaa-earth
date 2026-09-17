import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** `strong` for dialogs & navigation, `soft` for cards floating over content. */
  tone?: "soft" | "strong";
  interactive?: boolean;
}

/** Reusable translucent surface: the single source of glass styling. */
export function GlassPanel({
  as: Tag = "div",
  tone = "soft",
  interactive = false,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = Tag as any;

  return (
    <Component
      className={cn(
        "relative overflow-hidden rounded-xl glass-inner-top",
        tone === "strong" ? "glass-strong" : "glass",
        interactive &&
          "transition-[border-color,transform,background-color] duration-300 hover:border-border-strong hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function PanelHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-caps mb-1">{eyebrow}</p> : null}
        <h2 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}
