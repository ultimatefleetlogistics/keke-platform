import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex max-w-[720px] flex-col gap-4 px-8 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-20" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
