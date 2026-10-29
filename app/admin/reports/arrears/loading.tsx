import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-col gap-5 px-8 py-6">
        <StatCardsSkeleton count={2} />
        <TableSkeleton rows={4} cols={3} />
        <TableSkeleton rows={8} cols={7} />
      </div>
    </>
  );
}
