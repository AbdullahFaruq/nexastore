import { Panel } from "@/components/ui/panel";
import { Skeleton, SkeletonChart, SkeletonMetric, SkeletonRows } from "@/components/ui/skeleton";

/** Matches the dashboard's asymmetric hero so nothing shifts on load. */
export default function DashboardLoading() {
  return (
    <div className="px-4 sm:px-6 pt-5 pb-10">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-3 w-[320px] mt-2.5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-[130px]" />
          <Skeleton className="h-8 w-[96px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] gap-3 mb-4">
        <div className="min-h-[236px] rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-40 mt-3" />
          <Skeleton className="h-3 w-32 mt-3" />
          <Skeleton className="h-2 w-full mt-8 rounded-full" />
          <Skeleton className="h-3 w-52 mt-3" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonMetric key={i} />
          ))}
        </div>
      </div>

      <Panel className="p-5 mb-4">
        <SkeletonChart />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {["Top selling products", "Needs restocking"].map((title) => (
          <Panel key={title}>
            <div className="px-4 py-3 border-b border-[var(--line)]">
              <Skeleton className="h-3.5 w-[150px]" />
            </div>
            <SkeletonRows rows={6} cols={3} />
          </Panel>
        ))}
      </div>
    </div>
  );
}
