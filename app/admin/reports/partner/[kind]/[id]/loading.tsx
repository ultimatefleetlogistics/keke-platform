import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-col gap-5 px-8 py-6">
        <StatCardsSkeleton count={4} />
        <TableSkeleton rows={8} cols={3} />
      </div>
    </>
  );
}
