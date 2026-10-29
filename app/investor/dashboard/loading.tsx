import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-col gap-4.5 px-8 py-5.5">
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
        <Card className="p-5">
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="mt-4 h-[200px] w-full" />
        </Card>
        <TableSkeleton rows={5} cols={3} />
      </div>
    </>
  );
}
