import { cn } from "@/lib/utils";

/**
 * Loading placeholders mirror the shape of what is coming, so the page does
 * not jump when the data lands.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-[6px] bg-[var(--surface-3)]", className)}
      aria-hidden
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="p-4 border border-[var(--line)] rounded-[9px] bg-[var(--surface)]">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="size-6 rounded-[6px]" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-32 mb-2.5" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  const heights = [42, 68, 55, 80, 61, 92, 73, 58, 84, 66, 95, 71];
  return (
    <div className={cn("flex items-end gap-1.5 h-full min-h-[180px] px-1", className)} aria-hidden>
      {heights.map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t-[3px] rounded-b-none"
          style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[var(--line)]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3"
              style={{ flex: c === 0 ? 2 : 1, animationDelay: `${(r * cols + c) * 25}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
