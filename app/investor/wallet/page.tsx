import { redirect } from "next/navigation";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorWalletData } from "@/lib/data/wallet";
import { requestWalletWithdrawal, cancelWalletWithdrawal } from "@/lib/actions/wallet";
import { DepositIntentForm } from "./deposit-intent-form";

const SOURCE_LABEL: Record<string, string> = {
  PAYOUT_HELD: "Payout held in wallet",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  VEHICLE_FUNDING: "Put toward a new vehicle",
  MANUAL_ADJUSTMENT: "Manual adjustment",
};

const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Awaiting staff approval",
  APPROVED: "Approved, transfer in progress",
};

export default async function InvestorWalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const wallet = await getInvestorWalletData(user.investor);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-9 py-5.5">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Wallet</div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            Payouts staff choose to hold instead of sending to your bank land here, and so does anything you deposit
            yourself. This is a running figure, the real money stays in the company&apos;s account until you withdraw
            it or it goes toward a new vehicle.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-text-faint">Current balance</div>
          <div className="text-2xl font-extrabold text-accent-dark">
            <AnimatedNumber value={wallet.balance} format="naira" />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-9 py-6">
        <Card className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="lg:max-w-[280px]">
            <div className="text-sm font-extrabold">Deposit into your wallet</div>
            <div className="mt-1 text-[12.5px] text-text-soft">
              Send money to the account below to top up your wallet yourself, no staff involvement needed, it lands
              the moment the transfer confirms.
            </div>

            {wallet.depositAccountNumber ? (
              <div className="mt-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
                <div className="text-[15px] font-extrabold tracking-wide text-accent-dark">
                  {wallet.depositAccountNumber}
                </div>
                <div className="mt-0.5 text-[12px] text-text-soft">{wallet.depositAccountBankName}</div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-semibold text-warn-ink">
                Your deposit account is still being set up, check back shortly.
              </div>
            )}
          </div>

          <div className="lg:w-[280px] lg:border-l lg:border-border lg:pl-5">
            <DepositIntentForm
              currentIntent={wallet.depositIntent}
              currentVehicleType={wallet.depositIntentVehicleType}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-extrabold">Withdraw to your bank account</div>
            <div className="mt-1 text-[12.5px] text-text-soft">
              A staff member reviews every withdrawal before the transfer goes out, this is never automatic.
            </div>
          </div>

          {wallet.openWithdrawal ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <div>
                <div className="text-[13px] font-bold">{formatNaira(wallet.openWithdrawal.amount)} requested</div>
                <div className="mt-0.5 text-[12px] text-text-soft">
                  {WITHDRAWAL_STATUS_LABEL[wallet.openWithdrawal.status] ?? wallet.openWithdrawal.status}
                </div>
              </div>
              <Badge variant={wallet.openWithdrawal.status === "APPROVED" ? "accent" : "pending"}>
                {wallet.openWithdrawal.status === "APPROVED" ? "Approved" : "Pending"}
              </Badge>
              {wallet.openWithdrawal.status === "PENDING_APPROVAL" ? (
                <ActionForm action={cancelWalletWithdrawal}>
                  <input type="hidden" name="withdrawalId" value={wallet.openWithdrawal!.id} />
                  <ActionSubmitButton variant="outline" size="sm">
                    Cancel request
                  </ActionSubmitButton>
                </ActionForm>
              ) : null}
            </div>
          ) : !wallet.hasBankDetails ? (
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="text-[12.5px] font-semibold text-warn-ink">
                Add your bank details before you can request a withdrawal.
              </div>
              <Button asChild variant="outline">
                <Link href="/investor/payout-details">Add bank details</Link>
              </Button>
            </div>
          ) : wallet.balance <= 0 ? (
            <div className="text-[12.5px] font-semibold text-text-faint">Nothing in your wallet to withdraw yet.</div>
          ) : (
            <ActionForm action={requestWalletWithdrawal} className="flex items-end gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount (NGN)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  max={wallet.balance}
                  defaultValue={wallet.balance}
                  className="w-40"
                  required
                />
              </div>
              <ActionSubmitButton>Request withdrawal</ActionSubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Wallet history</div>
          {wallet.transactions.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 7v5.5l3.5 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="Nothing here yet"
              description="This fills in the first time a payout is held in your wallet instead of sent to your bank account."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-text-soft">{formatDate(t.createdAt)}</TableCell>
                    <TableCell className="font-semibold">
                      {SOURCE_LABEL[t.source] ?? t.source}
                      {t.fundedVehicle ? ` (${t.fundedVehicle})` : ""}
                    </TableCell>
                    <TableCell className={`font-bold ${t.type === "CREDIT" ? "text-good-ink" : "text-bad-ink"}`}>
                      {t.type === "CREDIT" ? "+" : "−"}
                      {formatNaira(t.amount)}
                    </TableCell>
                    <TableCell className="text-text-soft">{formatNaira(t.balanceAfter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
