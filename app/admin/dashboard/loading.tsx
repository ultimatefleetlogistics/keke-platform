import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton withAction />
      <div className="flex flex-col gap-4.5 px-8 py-5.5">
        <StatCardsSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="p-5">
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="mt-4 h-[200px] w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-3.5 w-32" />
            <div className="mt-4 flex items-center gap-4.5">
              <Skeleton className="h-[132px] w-[132px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <TableSkeleton rows={4} cols={4} />
          <Card className="p-4.5">
            <Skeleton className="h-3.5 w-32" />
            <div className="mt-4 flex flex-col gap-3.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
