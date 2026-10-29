import { HeaderSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="flex flex-col gap-5 px-8 py-6">
        <StatCardsSkeleton count={2} />
        <TableSkeleton rows={8} cols={6} />
      </div>
    </>
  );
}
