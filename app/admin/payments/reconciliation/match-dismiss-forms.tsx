"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { matchProviderTransaction, dismissProviderTransaction } from "@/lib/actions/reconciliation";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

/**
 * Module 27: matchProviderTransaction and dismissProviderTransaction used
 * to be bound directly to plain `<form action={...}>` elements on the
 * reconciliation page, so any failure (already resolved, no permission,
 * missing amount) crashed to Next's generic error boundary instead of
 * showing staff what actually went wrong. These two Client Components
 * replace those plain forms, calling the now-{error?}-returning actions
 * and displaying the message inline, the same pattern used for
 * bootstrapFirstAdmin, retryAgentCollectionAccount, and updatePayoutDetails.
 */
export function MatchTransactionForm({
  providerTransactionId,
  vehicleOptions,
}: {
  providerTransactionId: string;
  vehicleOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await matchProviderTransaction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-1.5">
      <div className="flex gap-2">
        <input type="hidden" name="providerTransactionId" value={providerTransactionId} />
        <select name="vehicleId" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled>
            Match to vehicle…
          </option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="shrink-0" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Matching..." : "Match"}
        </Button>
      </div>
      {error ? <div className="text-[12px] font-medium text-bad-ink">{error}</div> : null}
    </form>
  );
}

export function DismissTransactionForm({ providerTransactionId }: { providerTransactionId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await dismissProviderTransaction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <input type="hidden" name="providerTransactionId" value={providerTransactionId} />
      <Button type="submit" size="sm" variant="outline" disabled={isSubmitting} loading={isSubmitting}>
        {isSubmitting ? "Dismissing..." : "Not ours, dismiss"}
      </Button>
      {error ? <div className="text-[12px] font-medium text-bad-ink">{error}</div> : null}
    </form>
  );
}
