import { useEffect, useRef, useState, type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { cn } from "@/lib/utils";

/** Counts up to a target value once, respecting reduced-motion. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

export function StatCard({
  label,
  value,
  format,
  unit,
  icon,
  trend,
  hint,
  accent = "primary",
  delay = 0,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  unit?: string;
  icon: ReactNode;
  trend?: number | null;
  /** Quiet supporting line, e.g. "of 5 in the portfolio". */
  hint?: string;
  accent?: "primary" | "eco" | "violet";
  delay?: number;
}) {
  const animated = useCountUp(value);
  const accentClass =
    accent === "eco"
      ? "text-eco border-eco/25 bg-eco/8"
      : accent === "violet"
        ? "text-violet border-violet/25 bg-violet/8"
        : "text-primary border-primary/25 bg-primary/8";

  return (
    <GlassPanel
      interactive
      className="animate-rise p-3.5 sm:p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps min-w-0 leading-snug">{label}</p>
        <span
          className={cn("grid size-7 shrink-0 place-items-center rounded-md border", accentClass)}
        >
          {icon}
        </span>
      </div>
      <p className="num-tabular mt-2.5 text-[1.5rem] font-semibold leading-none tracking-tight text-foreground sm:text-[1.625rem]">
        {format(animated)}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-subtle-foreground">{unit}</span>
        ) : null}
      </p>
      <div className="mt-2 min-h-4">
        {typeof trend === "number" ? (
          <p
            className={cn(
              "flex items-center gap-1 text-[0.6875rem]",
              trend >= 0 ? "text-eco" : "text-destructive",
            )}
          >
            {trend >= 0 ? (
              <TrendingUp aria-hidden className="size-3" />
            ) : (
              <TrendingDown aria-hidden className="size-3" />
            )}
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(1)}%{" "}
            <span className="text-subtle-foreground">over recorded history</span>
          </p>
        ) : hint ? (
          <p className="truncate text-[0.6875rem] text-subtle-foreground">{hint}</p>
        ) : null}
      </div>
    </GlassPanel>
  );
}
