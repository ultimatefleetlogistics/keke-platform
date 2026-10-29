import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDueScheduleEntriesForBatch } from "@/lib/data/payments";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { NewBatchForm } from "./new-batch-form";

export default async function NewPaymentBatchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.PAYMENT_BATCH_CREATE)) {
    redirect("/admin/payments/batches");
  }

  const entries = await getDueScheduleEntriesForBatch();
  const totalIfAllSelected = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">New payment batch</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Everyone due or partially paid is selected by default, untick anyone you want to leave out of this batch.
          Where each payout goes (Module 26) is each investor&apos;s own standing choice, set at onboarding and
          editable by them anytime after, shown here so you can see it, not choose it, nothing to tick per row.
        </div>
      </header>

      <div className="px-8 py-6">
        {entries.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            Nothing is due right now, there is nothing to put into a batch.
          </Card>
        ) : (
          <NewBatchForm entries={entries} totalIfAllSelected={totalIfAllSelected} />
        )}
      </div>
    </>
  );
}
