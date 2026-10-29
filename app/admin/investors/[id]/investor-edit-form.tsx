"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateInvestor } from "@/lib/actions/investors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvestorEditForm({
  investorId,
  fullName,
  email,
  phone,
  defaultPayoutDestination,
}: {
  investorId: string;
  fullName: string;
  email: string;
  phone: string;
  defaultPayoutDestination: "BANK" | "WALLET";
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
    const result = await updateInvestor(formData);
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
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={email} required />
        <div className="text-[11.5px] text-text-faint">This is also what they sign in with.</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3.5 py-3">
        <label htmlFor="payoutDestination" className="flex cursor-pointer items-start gap-2.5">
          <input
            id="payoutDestination"
            name="payoutDestination"
            type="checkbox"
            value="WALLET"
            defaultChecked={defaultPayoutDestination === "WALLET"}
            className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
          />
          <span className="text-[13px] font-semibold text-text">
            Keep this investor&apos;s payouts in their wallet instead of paying to their bank account
          </span>
        </label>
        <div className="text-[11.5px] text-text-faint">
          Applied automatically to every new payment batch going forward, this never rewrites a batch already
          created.
        </div>
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {saved && !error ? <div className="text-[12.5px] font-medium text-good-ink">Saved.</div> : null}

      <div className="mt-1.5">
        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
