import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <div className="px-8 pt-5.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <div className="mt-4.5 flex flex-wrap gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="px-8 py-5">
        <CardGridSkeleton count={6} />
      </div>
    </>
  );
}
