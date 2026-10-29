import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton withAction />
      <div className="px-8 py-6">
        <TableSkeleton rows={6} cols={5} />
      </div>
    </>
  );
}
