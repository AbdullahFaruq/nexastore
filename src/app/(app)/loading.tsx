import { Skeleton, SkeletonChart, SkeletonMetric } from "@/components/ui/skeleton";
import { Panel } from "@/components/ui/panel";

/**
 * Route-level loading state.
 *
 * Mirrors the shape of a typical page - header, metric row, chart, table - so
 * the layout does not jump when the real content arrives.
 */
export default function AppLoading() {
  return (
    <div className="px-4 sm:px-6 pt-5 pb-10">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <Skeleton className="h-6 w-[180px]" />
          <Skeleton className="h-3 w-[280px] mt-2.5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-[130px]" />
          <Skeleton className="h-8 w-[96px]" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetric key={i} />
        ))}
      </div>

      <Panel className="p-5 mb-4">
        <SkeletonChart />
      </Panel>

      <Panel>
        <div className="px-4 py-3 border-b border-[var(--line)]">
          <Skeleton className="h-3.5 w-[140px]" />
        </div>
        <div className="divide-y divide-[var(--line)]">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-8 rounded-[7px] shrink-0" />
              <Skeleton className="h-3 flex-1" style={{ animationDelay: `${r * 40}ms` }} />
              <Skeleton className="h-3 w-[80px]" />
              <Skeleton className="h-3 w-[64px]" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
