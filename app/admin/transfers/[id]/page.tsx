import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KekeWatermark } from "@/components/design-system/keke-icon";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnershipTransferDetail } from "@/lib/data/transfers";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { verifyOwnershipTransfer, approveOwnershipTransfer, rejectOwnershipTransfer } from "@/lib/actions/transfers";

const STATUS_LABEL: Record<string, string> = {
  TARGET_ACHIEVED: "Awaiting verification",
  VERIFICATION_PENDING: "Awaiting verification",
  VERIFIED: "Awaiting approval",
  APPROVAL_PENDING: "Awaiting approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Sent back for correction",
};

export default async function OwnershipTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const canVerify = user.permissions.has(PERMISSIONS.TRANSFER_VERIFY);
  const canApprove = user.permissions.has(PERMISSIONS.TRANSFER_APPROVE);
  if (!canVerify && !canApprove) redirect("/admin/transfers");

  const transfer = await getOwnershipTransferDetail(id);
  if (!transfer) notFound();

  const isVerified = transfer.status === "VERIFIED";
  const isCompleted = transfer.status === "COMPLETED";
  const isRejected = transfer.status === "REJECTED";
  const awaitingVerification = transfer.status === "TARGET_ACHIEVED" || isRejected;
  const isVerifier = user.staff?.id === transfer.verifiedById;

  const steps = [
    { label: "Target reached", done: true, current: false },
    { label: "Verified", done: isVerified || isCompleted, current: awaitingVerification },
    { label: "Approved & handed over", done: isCompleted, current: isVerified },
  ];

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-8 py-5">
        <Link href={`/admin/fleet/${transfer.vehicle.id}`} className="text-[19px] font-extrabold tracking-tight hover:underline">
          {transfer.vehicle.assetTag}
        </Link>
        <Badge variant={isCompleted ? "good" : isRejected ? "bad" : "warn"}>
          {STATUS_LABEL[transfer.status] ?? transfer.status}
        </Badge>
        <Link href={`/admin/contracts/${transfer.contract.id}`} className="ml-auto text-[12.5px] font-bold text-accent-dark hover:underline">
          View full contract &rarr;
        </Link>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="relative overflow-hidden border-0 bg-[linear-gradient(165deg,#1F1A12,#C9820A)] p-6 text-white">
          <KekeWatermark className="absolute -bottom-4 -right-10 h-[160px] w-[210px]" opacity={0.14} />

          <div className="relative z-10 text-[13px] font-semibold text-[#F5E4C3]">
            {transfer.fromInvestor.fullName} has been paid {formatNaira(transfer.contract.totalPaidToInvestor)} of a{" "}
            {formatNaira(transfer.contract.targetPayoutAmount)} target, ownership of this vehicle moves to the manager
            once the handover below is verified and approved.
          </div>

          <div className="relative z-10 mt-6 flex items-center">
            {steps.map((step, index) => (
              <div key={step.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      step.done
                        ? "bg-white text-[#7A4A05]"
                        : step.current
                          ? "border-2 border-white bg-white/20 text-white"
                          : "border-2 border-white/40 text-white/70"
                    }`}
                  >
                    {step.done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="m5 12 5 5L20 7" stroke="#7A4A05" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className={`text-[11px] font-bold ${step.done || step.current ? "text-white" : "text-white/65"}`}>
                    {step.label}
                  </div>
                </div>
                {index < steps.length - 1 ? (
                  <div className={`mx-2 h-0.5 flex-1 ${step.done ? "bg-white" : "bg-white/30"}`} />
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        {isRejected && transfer.notes ? (
          <Card className="border-bad bg-bad-soft p-4.5 text-[13px] font-semibold text-bad-ink">
            Sent back for correction: &ldquo;{transfer.notes}&rdquo;
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="mb-3 text-sm font-extrabold">Contract summary</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Principal</div>
              <div className="mt-0.5 text-[14px] font-bold">{formatNaira(transfer.contract.principalAmount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Target payout</div>
              <div className="mt-0.5 text-[14px] font-bold">{formatNaira(transfer.contract.targetPayoutAmount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Paid to date</div>
              <div className="mt-0.5 text-[14px] font-bold text-good-ink">
                {formatNaira(transfer.contract.totalPaidToInvestor)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Started</div>
              <div className="mt-0.5 text-[14px] font-bold">
                {transfer.contract.startDate ? formatDate(transfer.contract.startDate) : "Not set"}
              </div>
            </div>
          </div>
        </Card>

        {(transfer.verifiedBy || transfer.approvedBy) && !isRejected ? (
          <Card className="p-4.5">
            <div className="mb-2 text-sm font-extrabold">Review history</div>
            <div className="flex flex-col gap-1.5">
              {transfer.verifiedBy ? (
                <div className="text-[12.5px] text-text-soft">
                  <span className="font-bold text-text">{transfer.verifiedBy}</span> verified this transfer
                  {transfer.verifiedAt ? ` on ${formatDate(transfer.verifiedAt)}` : ""}
                </div>
              ) : null}
              {transfer.approvedBy ? (
                <div className="text-[12.5px] text-text-soft">
                  <span className="font-bold text-text">{transfer.approvedBy}</span> approved this transfer
                  {transfer.approvedAt ? ` on ${formatDate(transfer.approvedAt)}` : ""}, the vehicle is now considered
                  handed over.
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {isCompleted ? null : awaitingVerification ? (
          canVerify ? (
            <Card className="flex flex-col gap-4 p-5">
              <div className="text-sm font-extrabold">Verify this transfer</div>
              <div className="text-[13px] text-text-soft">
                Confirm the paid-out total above is correct before this moves on for approval.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ActionForm action={verifyOwnershipTransfer} className="flex-1">
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <ActionSubmitButton className="w-full">Verify transfer</ActionSubmitButton>
                </ActionForm>
                <ActionForm action={rejectOwnershipTransfer} className="flex flex-1 gap-2">
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <input
                    name="notes"
                    placeholder="Reason for rejecting (optional)"
                    className="flex-1 rounded-xl border-[1.5px] border-border px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
                  />
                  <ActionSubmitButton variant="destructive">Reject</ActionSubmitButton>
                </ActionForm>
              </div>
            </Card>
          ) : (
            <Card className="p-4.5 text-[13px] text-text-soft">
              Your role doesn&apos;t include permission to verify ownership transfers.
            </Card>
          )
        ) : isVerified ? (
          canApprove ? (
            isVerifier ? (
              <Card className="border-warn bg-warn-soft p-4.5 text-[13px] font-semibold text-warn-ink">
                You verified this transfer, a different staff member with approval rights needs to approve it. This
                is enforced on the server too, not just hidden here.
              </Card>
            ) : (
              <Card className="flex flex-col gap-4 p-5">
                <div className="text-sm font-extrabold">Approve this transfer</div>
                <div className="text-[13px] text-text-soft">
                  This is the final step, approving hands the vehicle over and marks the contract completed.
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ActionForm action={approveOwnershipTransfer} className="flex-1">
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <ActionSubmitButton className="w-full">
                      Approve &amp; complete transfer
                    </ActionSubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectOwnershipTransfer} className="flex flex-1 gap-2">
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <input
                      name="notes"
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
              Your role doesn&apos;t include permission to approve ownership transfers.
            </Card>
          )
        ) : null}
      </div>
    </>
  );
}
