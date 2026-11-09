import { Skeleton } from "./ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-full space-y-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-8 w-44" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
            <Skeleton className="mt-5 h-5 w-40 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}

export function AssetGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-full sm:max-w-sm" />
        <Skeleton className="h-11 w-full sm:w-44" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border/70 bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-full space-y-2.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
            <Skeleton className="mt-5 h-[76px] rounded-lg" />
            <Skeleton className="mt-3 h-3.5 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="divide-y divide-border/60">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AssetViewSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-9 w-24 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[180px] rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-[160px] rounded-xl" />
        <Skeleton className="h-[160px] rounded-xl" />
      </div>
      <Skeleton className="h-[280px] rounded-xl" />
    </div>
  );
}
