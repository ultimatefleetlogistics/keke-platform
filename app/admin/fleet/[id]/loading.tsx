import { HeaderSkeleton, DetailSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="px-8 py-6">
        <DetailSkeleton />
      </div>
    </>
  );
}
