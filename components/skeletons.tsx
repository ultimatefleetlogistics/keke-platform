import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable skeleton shapes composed by every route's loading.tsx. Kept as
 * a small, shared set rather than one bespoke skeleton per page, so every
 * loading state in the app has the same rhythm and none of them drift
 * into looking like a different, less finished app.
 */

export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-8 py-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      {withAction ? <Skeleton className="h-9 w-32 rounded-xl" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="flex items-center gap-3.5 p-4">
          <Skeleton className="h-10.5 w-10.5 shrink-0 rounded-[13px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex gap-6 border-b border-border px-5 py-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex items-center gap-6 px-5 py-4 ${r > 0 ? "border-t border-border" : ""}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </Card>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="flex items-center justify-between gap-3.5 p-4">
          <div className="flex flex-1 flex-col gap-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-13 w-19 shrink-0 rounded-md" />
        </Card>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
