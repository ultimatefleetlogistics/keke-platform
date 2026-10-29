import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PasswordResetPanel } from "@/components/admin/password-reset-panel";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorById, getLatestBankChangeRequest } from "@/lib/data/onboarding";
import { getPaymentProvider } from "@/lib/payments/provider";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resetInvestorPassword, retryInvestorCollectionAccount } from "@/lib/actions/investors";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";
import { InvestorEditForm } from "./investor-edit-form";
import { InvestorBankForm } from "./investor-bank-form";

const KYC_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  NOT_STARTED: "neutral",
  PENDING_REVIEW: "warn",
  VERIFIED: "good",
  REJECTED: "bad",
};

const KYC_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const CONTRACT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  ACTIVE: "accent",
  TARGET_ACHIEVED: "warn",
  TRANSFER_IN_PROGRESS: "warn",
  COMPLETED: "good",
  CANCELLED: "bad",
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  TARGET_ACHIEVED: "Target reached, transfer pending",
  TRANSFER_IN_PROGRESS: "Ownership transfer in progress",
  COMPLETED: "Completed, ownership transferred",
  CANCELLED: "Cancelled",
};

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
};

const PAYMENT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending"> = {
  PAID: "good",
  DEFERRED: "warn",
  OVERDUE: "bad",
  UPCOMING: "pending",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  DEFERRED: "Deferred",
  OVERDUE: "Missed",
  UPCOMING: "Upcoming",
};

export default async function InvestorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ collectionAccountError?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.INVESTORS_VIEW) && !user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    redirect("/admin/investors");
  }

  const { id } = await params;
  const { collectionAccountError } = await searchParams;
  const investor = await getInvestorById(id);
  if (!investor) notFound();

  const latestBankChangeRequest = await getLatestBankChangeRequest(id);
  const pendingBankChangeRequest =
    latestBankChangeRequest?.status === "PENDING_APPROVAL" ? latestBankChangeRequest : null;

  const canManage = user.permissions.has(PERMISSIONS.INVESTORS_MANAGE);

  // Fetched for two reasons, not just one: canManage needs the full list
  // for the "Select a bank" dropdown in InvestorBankForm, but a view-only
  // staff member (INVESTORS_VIEW without INVESTORS_MANAGE) still needs it
  // too, purely to turn an already-saved bankCode like "058" back into
  // "Guaranty Trust Bank" below, see the bug this fixed in Module 30's own
  // README entry: bankCode is what Paystack's API actually deals in, this
  // app never stored a separate human-readable bank name next to it.
  let banks: Array<{ name: string; code: string }> = [];
  let banksError: string | null = null;
  if (canManage || investor.bankAccountNumber) {
    try {
      const provider = await getPaymentProvider();
      banks = await provider.listBanks();
    } catch (error) {
      banksError = error instanceof Error ? error.message : "Could not load the bank list from Paystack.";
    }
  }

  // Falls back to the raw code (still better than nothing) only when the
  // bank list itself couldn't be fetched, e.g. PAYSTACK_SECRET_KEY isn't
  // set on this machine yet.
  const bankName = banks.find((bank) => bank.code === investor.bankCode)?.name ?? investor.bankCode;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="text-[19px] font-extrabold tracking-tight">{investor.fullName}</div>
          <Badge variant={KYC_VARIANT[investor.kycStatus]}>{KYC_LABEL[investor.kycStatus]}</Badge>
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          {investor.email}
          {investor.phone ? ` · ${investor.phone}` : ""} · Member since {formatDate(investor.memberSince)}
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          {investor.activeContracts} active contract{investor.activeContracts === 1 ? "" : "s"},{" "}
          {investor.totalContracts} total. See{" "}
          <Link href="/admin/investors" className="font-bold text-accent-dark hover:underline">
            all investors
          </Link>
          .
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 px-8 pt-6 sm:grid-cols-4">
        <Card className="p-4.5">
          <div className="text-[11px] font-semibold text-text-soft">Total invested</div>
          <div className="mt-0.5 text-[17px] font-extrabold">{formatNaira(investor.totalInvested)}</div>
        </Card>
        <Card className="p-4.5">
          <div className="text-[11px] font-semibold text-text-soft">Total realized</div>
          <div className="mt-0.5 text-[17px] font-extrabold">{formatNaira(investor.totalRealized)}</div>
        </Card>
        <Card className="p-4.5">
          <div className="text-[11px] font-semibold text-text-soft">Outstanding</div>
          <div className="mt-0.5 text-[17px] font-extrabold">{formatNaira(investor.totalOutstanding)}</div>
        </Card>
        <Card className="p-4.5">
          <div className="text-[11px] font-semibold text-text-soft">Wallet balance</div>
          <div className="mt-0.5 text-[17px] font-extrabold text-accent-dark">{formatNaira(investor.walletBalance)}</div>
        </Card>
      </div>

      <div className="px-8 pt-6">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">
            Investments ({investor.investments.length})
          </div>
          {investor.investments.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">
              No investment contract has ever been written for this investor.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
              {investor.investments.map((investment) => (
                <Card key={investment.id} className="border-border p-4.5 shadow-none">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/admin/fleet/${investment.vehicleId}`}
                        className="text-[14px] font-extrabold hover:underline"
                      >
                        {VEHICLE_TYPE_LABELS[investment.vehicleType]} {investment.vehicleAssetTag}
                      </Link>
                      <div className="mt-0.5 text-[12px] text-text-faint">
                        Started {investment.startDate ? formatDate(investment.startDate) : "not started yet"}
                      </div>
                    </div>
                    <Badge variant={CONTRACT_STATUS_VARIANT[investment.contractStatus] ?? "neutral"}>
                      {CONTRACT_STATUS_LABEL[investment.contractStatus] ?? investment.contractStatus}
                    </Badge>
                  </div>
                  <div className="my-3 flex items-center justify-between text-[12px] font-semibold text-text-soft">
                    <span>Progress toward payout</span>
                    <span className="text-text">{investment.progressPercent}%</span>
                  </div>
                  <Progress value={investment.progressPercent} />
                  <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-[10.5px] font-semibold text-text-faint">Principal</div>
                      <div className="mt-0.5 text-[13px] font-bold">{formatNaira(investment.principal)}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold text-text-faint">Target</div>
                      <div className="mt-0.5 text-[13px] font-bold">{formatNaira(investment.target)}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold text-text-faint">Realized</div>
                      <div className="mt-0.5 text-[13px] font-bold text-good-ink">{formatNaira(investment.realized)}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold text-text-faint">
                        {FREQUENCY_LABEL[investment.frequency] ?? "Installment"}
                      </div>
                      <div className="mt-0.5 text-[13px] font-bold">{formatNaira(investment.installment)}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="px-8 pt-6">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">
            Payment history ({investor.paymentHistory.length})
          </div>
          {investor.paymentHistory.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No payments recorded yet.</div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-t-0 hover:bg-transparent">
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investor.paymentHistory.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-semibold">{payment.vehicleAssetTag}</TableCell>
                      <TableCell className="font-bold">{formatNaira(payment.amount)}</TableCell>
                      <TableCell className="text-text-soft">{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS_VARIANT[payment.status] ?? "neutral"}>
                          {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 px-8 py-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          <Card className="p-6">
            {canManage ? (
              <InvestorEditForm
                investorId={investor.id}
                fullName={investor.fullName}
                email={investor.email}
                phone={investor.phone ?? ""}
                defaultPayoutDestination={investor.defaultPayoutDestination}
              />
            ) : (
              <div className="text-[13px] text-text-soft">
                Your role doesn&apos;t include permission to edit investor records.
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4 text-[13.5px] font-extrabold">Account access</div>
            {canManage ? (
              <PasswordResetPanel
                action={resetInvestorPassword}
                idFieldName="investorId"
                idValue={investor.id}
                subjectLabel={investor.fullName}
              />
            ) : (
              <div className="text-[13px] text-text-soft">
                Your role doesn&apos;t include permission to reset this investor&apos;s password.
              </div>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-4 text-[13.5px] font-extrabold">Bank account</div>

          {investor.bankAccountNumber ? (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
              <div>
                <div className="text-[13.5px] font-bold">{investor.bankAccountName}</div>
                <div className="mt-0.5 text-[12px] text-text-soft">
                  {investor.bankAccountNumber} &middot; {bankName}
                </div>
              </div>
              <Badge variant="good">On file</Badge>
            </div>
          ) : (
            <div className="mb-5 rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-semibold text-warn-ink">
              No payout account on file yet, they won&apos;t be able to receive a bank transfer until one is added.
            </div>
          )}

          {pendingBankChangeRequest ? (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-4 py-3">
              <div>
                <div className="text-[12px] font-semibold text-accent-dark">
                  They&apos;ve requested a change, awaiting your review
                </div>
                <div className="mt-0.5 text-[13px] font-bold">
                  {pendingBankChangeRequest.accountName} &middot; {pendingBankChangeRequest.accountNumber}
                </div>
              </div>
              <Link
                href="/admin/wallet/bank-change-requests"
                className="text-[12.5px] font-bold text-accent-dark hover:underline"
              >
                Review →
              </Link>
            </div>
          ) : null}

          {!canManage ? (
            <div className="text-[13px] text-text-soft">
              Your role doesn&apos;t include permission to edit investor records.
            </div>
          ) : banksError ? (
            <div className="rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
              {banksError} Add a working <code className="font-mono">PAYSTACK_SECRET_KEY</code> to try again.
            </div>
          ) : (
            <InvestorBankForm investorId={investor.id} banks={banks} hasAccountOnFile={Boolean(investor.bankAccountNumber)} />
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-1 text-[13.5px] font-extrabold">Deposit account</div>
          <div className="mb-4 text-[12.5px] text-text-soft">
            Where this investor sends money in, the opposite direction from the bank account above. A Paystack
            Dedicated Virtual Account, same as agents and drivers already have for remittances.
          </div>

          {collectionAccountError ? (
            <div className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
              Couldn&apos;t create the deposit account: {collectionAccountError}
            </div>
          ) : null}

          {investor.depositAccountNumber ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
              <div>
                <div className="text-[13.5px] font-bold">{investor.depositAccountNumber}</div>
                <div className="mt-0.5 text-[12px] text-text-soft">{investor.depositAccountBankName}</div>
              </div>
              <Badge variant="good">Active</Badge>
            </div>
          ) : canManage ? (
            <div className="flex items-center gap-2.5">
              <Badge variant="pending" className="w-fit">
                Not set up
              </Badge>
              <form action={retryInvestorCollectionAccount}>
                <input type="hidden" name="investorId" value={investor.id} />
                <SubmitButton size="sm" variant="outline">
                  Create
                </SubmitButton>
              </form>
            </div>
          ) : (
            <Badge variant="pending" className="w-fit">
              Not set up
            </Badge>
          )}
        </Card>
      </div>
    </>
  );
}
