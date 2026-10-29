import { redirect } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getWalletWithdrawalQueue } from "@/lib/data/wallet";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { approveWalletWithdrawal, rejectWalletWithdrawal, markWalletWithdrawalPaid } from "@/lib/actions/wallet";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  PENDING_APPROVAL: "pending",
  APPROVED: "accent",
  REJECTED: "bad",
  PAID: "good",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved, awaiting confirmation",
  REJECTED: "Rejected",
  PAID: "Paid",
  // Set by the investor themselves (Module 23), never by staff, see
  // cancelWalletWithdrawal in lib/actions/wallet.ts. Distinct from
  // Rejected on purpose, so this list still shows who actually decided
  // what.
  CANCELLED: "Cancelled by investor",
};

export default async function WalletWithdrawalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.WALLET_VIEW)) redirect("/admin/wallet");

  const withdrawals = await getWalletWithdrawalQueue();
  const canApprove = user.permissions.has(PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);
  const pending = withdrawals.filter((w) => w.status === "PENDING_APPROVAL" || w.status === "APPROVED");
  const decided = withdrawals.filter(
    (w) => w.status === "REJECTED" || w.status === "PAID" || w.status === "CANCELLED"
  );

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Withdrawal requests</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every request needs a staff decision before any money moves, bank transfers are never sent automatically.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        {pending.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">Nothing waiting on a decision right now.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((w) => (
              <Card key={w.id} className="flex flex-col gap-3.5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">{w.investorName}</div>
                    <div className="mt-0.5 text-[12.5px] text-text-soft">
                      Requested {formatDate(w.createdAt)} &middot; wallet balance {formatNaira(w.walletBalance)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-lg font-extrabold">{formatNaira(w.amount)}</div>
                    <Badge variant={STATUS_VARIANT[w.status] ?? "pending"}>{STATUS_LABEL[w.status] ?? w.status}</Badge>
                  </div>
                </div>

                {w.failureReason ? (
                  <div className="rounded-xl border border-bad bg-bad-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-bad-ink">
                    Automatic transfer didn&apos;t confirm: {w.failureReason}. Confirm manually below once you&apos;ve
                    sent it, or check the transfer in Paystack.
                  </div>
                ) : null}

                {!w.hasBankDetails ? (
                  <div className="text-[12.5px] font-semibold text-warn-ink">
                    This investor has no bank account on file yet.
                  </div>
                ) : null}

                {canApprove ? (
                  w.status === "PENDING_APPROVAL" ? (
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <ActionForm action={approveWalletWithdrawal} className="flex-1">
                        <input type="hidden" name="withdrawalId" value={w.id} />
                        <ActionSubmitButton className="w-full">
                          Approve &amp; send {formatNaira(w.amount)}
                        </ActionSubmitButton>
                      </ActionForm>
                      <ActionForm action={rejectWalletWithdrawal} className="flex flex-1 gap-2">
                        <input type="hidden" name="withdrawalId" value={w.id} />
                        <input
                          name="reason"
                          placeholder="Reason for declining (optional)"
                          className="flex-1 rounded-xl border-[1.5px] border-border px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
                        />
                        <ActionSubmitButton variant="destructive">Decline</ActionSubmitButton>
                      </ActionForm>
                    </div>
                  ) : (
                    <ActionForm action={markWalletWithdrawalPaid}>
                      <input type="hidden" name="withdrawalId" value={w.id} />
                      <ActionSubmitButton variant="outline" className="w-full">
                        Mark as paid
                      </ActionSubmitButton>
                    </ActionForm>
                  )
                ) : (
                  <div className="text-[12.5px] text-text-soft">Your role doesn&apos;t include withdrawal approval.</div>
                )}
              </Card>
            ))}
          </div>
        )}

        {decided.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Review history</div>
            <div className="flex flex-col">
              {decided.map((w, index) => (
                <div
                  key={w.id}
                  className={`flex items-center justify-between px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div>
                    <span className="font-bold">{w.investorName}</span>{" "}
                    <span className="text-text-soft">
                      {formatNaira(w.amount)} &middot;{" "}
                      {w.status === "CANCELLED"
                        ? `cancelled by ${w.investorName}`
                        : w.reviewedBy
                          ? `reviewed by ${w.reviewedBy}`
                          : "system"}{" "}
                      on{" "}
                      {w.reviewedAt ? formatDate(w.reviewedAt) : formatDate(w.createdAt)}
                    </span>
                  </div>
                  <Badge variant={STATUS_VARIANT[w.status] ?? "neutral"}>{STATUS_LABEL[w.status] ?? w.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
