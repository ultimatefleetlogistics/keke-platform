import { redirect, notFound } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentBatchDetail } from "@/lib/data/payments";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { approvePaymentBatch, rejectPaymentBatch } from "@/lib/actions/payments";

const BATCH_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  PARTIALLY_FAILED: "Partially failed",
  REJECTED: "Rejected",
};

const BATCH_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  APPROVED: "accent",
  PROCESSING: "pending",
  COMPLETED: "good",
  PARTIALLY_FAILED: "bad",
  REJECTED: "bad",
};

const ITEM_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending"> = {
  PENDING: "pending",
  SUCCESS: "good",
  FAILED: "bad",
};

export default async function PaymentBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.PAYMENTS_VIEW)) redirect("/admin/payments/batches");

  const batch = await getPaymentBatchDetail(id);
  if (!batch) notFound();

  const canApprove = user.permissions.has(PERMISSIONS.PAYMENT_BATCH_APPROVE);
  const isCreator = user.staff?.id === batch.createdById;
  const isPendingApproval = batch.status === "PENDING_APPROVAL";

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="text-[19px] font-extrabold tracking-tight">{batch.periodLabel}</div>
          <Badge variant={BATCH_STATUS_VARIANT[batch.status] ?? "neutral"}>{BATCH_STATUS_LABEL[batch.status]}</Badge>
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Created by {batch.createdBy} on {formatDate(batch.createdAt)} &middot; {formatNaira(batch.totalAmount)} total
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableHead>Investor</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.investor}</TableCell>
                  <TableCell className="text-text-soft">{item.vehicle}</TableCell>
                  <TableCell className="font-bold">{formatNaira(item.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={item.payoutDestination === "WALLET" ? "accent" : "neutral"}>
                      {item.payoutDestination === "WALLET" ? "Wallet" : "Bank"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ITEM_STATUS_VARIANT[item.transferStatus] ?? "pending"}>
                      {item.transferStatus === "SUCCESS"
                        ? item.payoutDestination === "WALLET"
                          ? "Held"
                          : "Paid"
                        : item.transferStatus === "FAILED"
                          ? "Failed"
                          : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-faint">{item.failureReason ?? "Not set"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {batch.approvals.length > 0 ? (
          <Card className="p-4.5">
            <div className="mb-2 text-sm font-extrabold">Review history</div>
            <div className="flex flex-col gap-2">
              {batch.approvals.map((approval, index) => (
                <div key={index} className="text-[12.5px] text-text-soft">
                  <span className="font-bold text-text">{approval.by}</span>{" "}
                  {approval.decision === "APPROVED" ? "approved" : "rejected"} this batch on {formatDate(approval.createdAt)}
                  {approval.note ? `: "${approval.note}"` : ""}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {isPendingApproval ? (
          canApprove ? (
            isCreator ? (
              <Card className="border-warn bg-warn-soft p-4.5 text-[13px] font-semibold text-warn-ink">
                You created this batch, a different staff member with approval rights needs to review it. This is
                enforced on the server too, not just hidden here.
              </Card>
            ) : (
              <Card className="flex flex-col gap-4 p-5">
                <div className="text-sm font-extrabold">Review this batch</div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ActionForm action={approvePaymentBatch} className="flex-1">
                    <input type="hidden" name="batchId" value={batch.id} />
                    <ActionSubmitButton className="w-full">
                      Approve &amp; pay {formatNaira(batch.totalAmount)}
                    </ActionSubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectPaymentBatch} className="flex flex-1 gap-2">
                    <input type="hidden" name="batchId" value={batch.id} />
                    <input
                      name="note"
                      placeholder="Reason for rejecting (optional)"
                      className="flex-1 rounded-xl border-[1.5px] border-border px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
                    />
                    <ActionSubmitButton variant="destructive">Reject</ActionSubmitButton>
                  </ActionForm>
                </div>
              </Card>
            )
          ) : (
            <Card className="p-4.5 text-[13px] text-text-soft">
              Your role doesn&apos;t include permission to approve payment batches.
            </Card>
          )
        ) : null}
      </div>
    </>
  );
}
