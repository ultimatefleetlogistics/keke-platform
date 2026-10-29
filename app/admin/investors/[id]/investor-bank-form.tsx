"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateInvestorBankDetails } from "@/lib/actions/investors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The admin-side equivalent of /investor/payout-details/bank-account-form.tsx,
 * same Paystack-verify-before-save flow, scoped to a specific investor by
 * `investorId` instead of the signed-in user. Client Component for the
 * same reason as that one: updateInvestorBankDetails returns `{error?}`
 * instead of throwing, and a plain `<form action={fn}>` has nowhere to
 * show that.
 */
export function InvestorBankForm({
  investorId,
  banks,
  hasAccountOnFile,
}: {
  investorId: string;
  banks: Array<{ name: string; code: string }>;
  hasAccountOnFile: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await updateInvestorBankDetails(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="investorId" value={investorId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bankCode">Bank</Label>
        <select
          id="bankCode"
          name="bankCode"
          required
          defaultValue=""
          className="flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
        >
          <option value="" disabled>
            Select a bank
          </option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountNumber">Account number</Label>
        <Input id="accountNumber" name="accountNumber" inputMode="numeric" maxLength={10} placeholder="10 digit NUBAN" required />
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {saved && !error ? <div className="text-[12.5px] font-medium text-good-ink">Saved.</div> : null}

      <div>
        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Verifying with the bank..." : hasAccountOnFile ? "Update bank account" : "Save bank account"}
        </Button>
      </div>
    </form>
  );
}
