"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { requestPayoutDetailsChange } from "@/lib/actions/investor-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client Component so the real Paystack error from requestPayoutDetailsChange
 * (Module 26 fix, it used to throw and crash the page instead of
 * returning this) has somewhere to actually be shown, a plain
 * `<form action={fn}>` bound directly to a throwing Server Action has no
 * way to display anything, it just crashes. Module 41: submitting this no
 * longer saves the account directly, it creates a request a staff member
 * reviews, see the page's own "Pending staff review" state for what shows
 * once this succeeds.
 */
export function BankAccountForm({
  banks,
  hasAccountOnFile,
}: {
  banks: Array<{ name: string; code: string }>;
  hasAccountOnFile: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await requestPayoutDetailsChange(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            Select your bank
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

      <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="mt-1">
        {isSubmitting
          ? "Verifying with the bank..."
          : hasAccountOnFile
            ? "Request account change"
            : "Request payout account"}
      </Button>
    </form>
  );
}
