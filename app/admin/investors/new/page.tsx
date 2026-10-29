import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments/provider";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createInvestor } from "@/lib/actions/investors";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

export default async function NewInvestorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    redirect("/admin/investors");
  }

  // Module 30: bank account entry offered right here, at the point of
  // actually onboarding the investor, not only afterward on their edit
  // page. Optional, so a missing or misconfigured PAYSTACK_SECRET_KEY (or
  // staff simply not having the bank details on hand yet) never blocks
  // creating the account itself, see banksError below.
  let banks: Array<{ name: string; code: string }> = [];
  let banksError: string | null = null;
  try {
    const provider = await getPaymentProvider();
    banks = await provider.listBanks();
  } catch (error) {
    banksError = error instanceof Error ? error.message : "Could not load the bank list from Paystack.";
  }

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Add investor</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          This creates a real sign in account for them. A temporary password is generated and shown once, you pass
          it on to the investor directly.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          <ActionForm action={createInvestor} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" name="fullName" placeholder="Amaka Obi" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="amaka@example.com" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="080..." />
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3.5 py-3">
                  <label htmlFor="payoutDestination" className="flex cursor-pointer items-start gap-2.5">
                    <input
                      id="payoutDestination"
                      name="payoutDestination"
                      type="checkbox"
                      value="WALLET"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
                    />
                    <span className="text-[13px] font-semibold text-text">
                      Keep this investor&apos;s payouts in their wallet instead of paying to their bank account
                    </span>
                  </label>
                  <div className="text-[11.5px] text-text-faint">
                    Leave unticked to pay their bank account directly (the default). Applied automatically every time a
                    payment batch is created for them, no one has to remember to pick it per payment. The investor can
                    change this themselves later from Payout details in their own portal.
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border bg-background px-3.5 py-3.5">
                  <div>
                    <div className="text-[13px] font-bold">Bank account (optional)</div>
                    <div className="mt-0.5 text-[11.5px] text-text-faint">
                      Where their weekly payout should land. We confirm the account with the bank before saving it, so
                      it can never be pointed at one that doesn&apos;t exist. Don&apos;t have these yet? Leave both
                      blank, this can always be added later from the investor&apos;s own edit page.
                    </div>
                  </div>

                  {banksError ? (
                    <div className="rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
                      {banksError} Add a working <code className="font-mono">PAYSTACK_SECRET_KEY</code> to enter a bank
                      account now, or skip this and add it later once that&apos;s configured.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bankCode">Bank</Label>
                        <select id="bankCode" name="bankCode" defaultValue="" className={SELECT_CLASS}>
                          <option value="">Not entered yet</option>
                          {banks.map((bank) => (
                            <option key={bank.code} value={bank.code}>
                              {bank.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="accountNumber">Account number</Label>
                        <Input id="accountNumber" name="accountNumber" inputMode="numeric" maxLength={10} placeholder="10 digit NUBAN" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/admin/investors">Cancel</Link>
                  </Button>
                  <ActionSubmitButton className="flex-[2]">Create investor</ActionSubmitButton>
                </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
