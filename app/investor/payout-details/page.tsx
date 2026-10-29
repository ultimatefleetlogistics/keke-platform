import { redirect } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getLatestBankChangeRequest } from "@/lib/data/onboarding";
import { cancelBankChangeRequest } from "@/lib/actions/investor-profile";
import { BankAccountForm } from "./bank-account-form";
import { PayoutDestinationForm } from "./payout-destination-form";

const REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending staff review",
  REJECTED: "Declined",
};

export default async function PayoutDetailsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const investor = user.investor;

  let banks: Array<{ name: string; code: string }> = [];
  let banksError: string | null = null;
  try {
    const provider = await getPaymentProvider();
    banks = await provider.listBanks();
  } catch (error) {
    banksError = error instanceof Error ? error.message : "Could not load the bank list from Paystack.";
  }

  // bankCode ("058") is what Paystack's API deals in, this app never
  // stored a separate human-readable bank name next to it, so it's turned
  // back into "Guaranty Trust Bank" here from the same list the dropdown
  // below uses. Falls back to the raw code only if the list itself
  // couldn't load, see Module 30's README entry for the bug this fixed.
  const bankName = banks.find((bank) => bank.code === investor.bankCode)?.name ?? investor.bankCode;

  // Module 41: a bank account change is now a request a staff member
  // reviews, not an instant save, see requestPayoutDetailsChange in
  // lib/actions/investor-profile.ts. Only ever the latest request, an
  // open one blocks a second (the form below is hidden while one is
  // pending), an already-decided one is just shown for context and lets
  // the form re-open.
  const latestRequest = await getLatestBankChangeRequest(investor.id);
  const pendingRequest = latestRequest?.status === "PENDING_APPROVAL" ? latestRequest : null;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Payout details</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Where your weekly payouts are sent, and where new ones default to going. We confirm your bank account with
          the bank before submitting a change, so it can never be pointed at an account that doesn&apos;t exist, and a
          staff member reviews every change before it takes effect.
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 px-8 py-6 lg:grid-cols-2 lg:items-start">
        <Card className="p-6">
          <div className="mb-4 text-[13.5px] font-extrabold">Payout destination</div>
          <PayoutDestinationForm currentDestination={investor.defaultPayoutDestination} />
        </Card>

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
              No payout account on file yet, you won&apos;t be able to receive a bank transfer until you add one.
            </div>
          )}

          {pendingRequest ? (
            <div className="flex flex-col gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3.5">
              <div>
                <div className="text-[12px] font-semibold text-accent-dark">
                  {REQUEST_STATUS_LABEL[pendingRequest.status] ?? pendingRequest.status}
                </div>
                <div className="mt-1 text-[13.5px] font-bold">
                  {pendingRequest.accountName} &middot; {pendingRequest.accountNumber}
                </div>
                <div className="mt-0.5 text-[12px] text-text-soft">{pendingRequest.bankName}</div>
              </div>
              <ActionForm action={cancelBankChangeRequest}>
                <input type="hidden" name="requestId" value={pendingRequest.id} />
                <ActionSubmitButton variant="outline" size="sm">
                  Cancel request
                </ActionSubmitButton>
              </ActionForm>
            </div>
          ) : banksError ? (
            <div className="mb-4 rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
              {banksError} Add a working <code className="font-mono">PAYSTACK_SECRET_KEY</code> to try again.
            </div>
          ) : (
            <>
              {latestRequest?.status === "REJECTED" ? (
                <div className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-semibold text-warn-ink">
                  Your last request was declined
                  {latestRequest.reviewNote ? `: "${latestRequest.reviewNote}"` : "."} Your account on file above is
                  unchanged, you can request another change below.
                </div>
              ) : null}
              <BankAccountForm banks={banks} hasAccountOnFile={Boolean(investor.bankAccountNumber)} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
