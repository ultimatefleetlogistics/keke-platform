import { redirect } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBankChangeRequestQueue } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { approveBankChangeRequest, rejectBankChangeRequest } from "@/lib/actions/investors";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  PENDING_APPROVAL: "pending",
  APPROVED: "good",
  REJECTED: "bad",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  // Set by the investor themselves, never by staff, see
  // cancelBankChangeRequest in lib/actions/investor-profile.ts. Distinct
  // from Rejected on purpose, same reasoning as WalletWithdrawalStatus's
  // own CANCELLED.
  CANCELLED: "Cancelled by investor",
};

export default async function BankChangeRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) redirect("/admin/wallet");

  const requests = await getBankChangeRequestQueue();
  const pending = requests.filter((r) => r.status === "PENDING_APPROVAL");
  const decided = requests.filter((r) => r.status !== "PENDING_APPROVAL");

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Bank change requests</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          An investor asking to change the bank account their payouts and withdrawals go to. The account is already
          confirmed with the bank, nothing changes on their record until you decide here.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        {pending.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">Nothing waiting on a decision right now.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3.5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">{r.investorName}</div>
                    <div className="mt-0.5 text-[12.5px] text-text-soft">Requested {formatDate(r.createdAt)}</div>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "pending"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold text-text-faint">Current account on file</div>
                    <div className="mt-1 text-[13px] font-bold">
                      {r.currentAccountNumber ? `${r.currentAccountName} · ${r.currentAccountNumber}` : "None yet"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-accent bg-accent-soft px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold text-accent-dark">Requested account</div>
                    <div className="mt-1 text-[13px] font-bold">
                      {r.requestedAccountName} · {r.requestedAccountNumber}
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-soft">{r.requestedBankName}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <ActionForm action={approveBankChangeRequest} className="flex-1">
                    <input type="hidden" name="requestId" value={r.id} />
                    <ActionSubmitButton className="w-full">Approve change</ActionSubmitButton>
                  </ActionForm>
                  <ActionForm action={rejectBankChangeRequest} className="flex flex-1 gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input
                      name="reason"
                      placeholder="Reason for declining (optional)"
                      className="flex-1 rounded-xl border-[1.5px] border-border px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
                    />
                    <ActionSubmitButton variant="destructive">Decline</ActionSubmitButton>
                  </ActionForm>
                </div>
              </Card>
            ))}
          </div>
        )}

        {decided.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Review history</div>
            <div className="flex flex-col">
              {decided.map((r, index) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div>
                    <span className="font-bold">{r.investorName}</span>{" "}
                    <span className="text-text-soft">
                      {r.requestedAccountName} &middot; {r.requestedAccountNumber} &middot;{" "}
                      {r.status === "CANCELLED"
                        ? `cancelled by ${r.investorName}`
                        : r.reviewedBy
                          ? `reviewed by ${r.reviewedBy}`
                          : "system"}{" "}
                      on {r.reviewedAt ? formatDate(r.reviewedAt) : formatDate(r.createdAt)}
                    </span>
                    {r.reviewNote ? <div className="mt-0.5 text-[12px] text-text-faint">&ldquo;{r.reviewNote}&rdquo;</div> : null}
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
