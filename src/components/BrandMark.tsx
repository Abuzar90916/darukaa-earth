import { cn } from "@/lib/utils";

/** DARUKAA.EARTH wordmark. Never rename the product. */
export function BrandMark({
  className,
  descriptor,
  size = "md",
}: {
  className?: string;
  descriptor?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="min-w-0">
        <span
          className={cn("block font-semibold tracking-[0.16em] text-foreground uppercase", text)}
        >
          Darukaa<span className="text-primary">.Earth</span>
        </span>
        {descriptor ? <span className="label-caps block">{descriptor}</span> : null}
      </span>
    </div>
  );
}
