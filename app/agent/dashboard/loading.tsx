import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-col gap-4.5 px-8 py-5.5">
        <StatCardsSkeleton count={3} />
        <Card className="p-5">
          <Skeleton className="h-3.5 w-56" />
          <Skeleton className="mt-4 h-[200px] w-full" />
        </Card>
        <TableSkeleton rows={5} cols={4} />
      </div>
    </>
  );
}
