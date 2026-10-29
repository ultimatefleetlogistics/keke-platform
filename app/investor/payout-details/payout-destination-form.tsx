"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updatePayoutDestination } from "@/lib/actions/investor-profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Module 26: an investor's own standing choice for where a batch payout
 * lands, set initially by staff at onboarding and editable here at any
 * time afterward. Deliberately its own small form separate from
 * BankAccountForm, saving this never depends on a bank account existing
 * (an investor keeping everything in the wallet may never add one), and
 * it never calls Paystack, no reason to bundle its error handling with
 * the bank form's.
 */
export function PayoutDestinationForm({ currentDestination }: { currentDestination: "BANK" | "WALLET" }) {
  const router = useRouter();
  const [destination, setDestination] = useState(currentDestination);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await updatePayoutDestination(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="payoutDestination">Where should new payouts go?</Label>
        <label htmlFor="payoutDestination" className="flex cursor-pointer items-start gap-2.5">
          <input
            id="payoutDestination"
            name="payoutDestination"
            type="checkbox"
            value="WALLET"
            checked={destination === "WALLET"}
            onChange={(e) => setDestination(e.target.checked ? "WALLET" : "BANK")}
            className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
          />
          <span className="text-[13.5px] font-semibold text-text">Keep it in my wallet instead of my bank account</span>
        </label>
        <div className="text-[11.5px] text-text-faint">
          Leave unticked to pay your bank account directly. Applied automatically to every payment batch you&apos;re
          included in going forward, this never changes a batch that&apos;s already been created.
        </div>
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {saved && !error ? <div className="text-[12.5px] font-medium text-good-ink">Saved.</div> : null}

      <Button
        type="submit"
        disabled={isSubmitting || destination === currentDestination}
        loading={isSubmitting}
        variant="outline"
        className="w-fit"
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
