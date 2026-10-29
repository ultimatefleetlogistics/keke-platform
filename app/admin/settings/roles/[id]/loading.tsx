import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <Skeleton className="h-3.5 w-28" />
          <div className="mt-4 flex flex-col gap-5">
            {Array.from({ length: 2 }).map((_, group) => (
              <div key={group}>
                <Skeleton className="mb-2 h-2.5 w-24" />
                <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {Array.from({ length: 3 }).map((_, row) => (
                    <div key={row} className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-2.5 w-56" />
                      </div>
                      <Skeleton className="h-8 w-16 shrink-0 rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="h-fit p-6">
          <Skeleton className="h-3.5 w-20" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
