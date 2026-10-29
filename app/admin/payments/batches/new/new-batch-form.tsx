"use client";

import { useState } from "react";
import Link from "next/link";

import { createPaymentBatch } from "@/lib/actions/payments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatNaira } from "@/lib/utils";

type DueEntry = {
  scheduleEntryId: string;
  investorName: string;
  vehicle: string;
  dueDate: string;
  amount: number;
  payoutDestination: "BANK" | "WALLET";
  walletBalance: number;
};

/**
 * Module 27: createPaymentBatch used to be bound directly to a plain
 * `<form action={createPaymentBatch}>`, throwing on every validation
 * failure ("select at least one investor"), which crashed to Next's
 * generic error boundary the same way matchProviderTransaction and the
 * other throw-bound actions did. Converted to a Client Component so the
 * now-{error?}-returning action's message actually reaches the screen,
 * this also has to be here to display the new "contracts already
 * reached target" error createPaymentBatch can return, see that
 * function's doc comment.
 */
export function NewBatchForm({ entries, totalIfAllSelected }: { entries: DueEntry[]; totalIfAllSelected: number }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await createPaymentBatch(formData);
    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
    }
    // No error and no thrown redirect means createPaymentBatch's own
    // redirect() already took over navigation.
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[0.4fr_1.4fr_1fr_1fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
          <span />
          <span>Investor</span>
          <span>Vehicle</span>
          <span>Due since</span>
          <span>Amount</span>
          <span>Pays out to</span>
        </div>
        {entries.map((entry, index) => (
          <div
            key={entry.scheduleEntryId}
            className={`grid grid-cols-[0.4fr_1.4fr_1fr_1fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold ${
              index > 0 ? "border-t border-border" : ""
            }`}
          >
            <input
              id={`select-${entry.scheduleEntryId}`}
              type="checkbox"
              name="scheduleEntryId"
              value={entry.scheduleEntryId}
              defaultChecked
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor={`select-${entry.scheduleEntryId}`} className="cursor-pointer">
              {entry.investorName}
            </label>
            <span className="font-medium text-text-soft">{entry.vehicle}</span>
            <span className="text-text-soft">{formatDate(entry.dueDate)}</span>
            <span className="font-bold">{formatNaira(entry.amount)}</span>
            <div className="flex flex-col gap-0.5">
              <Badge variant={entry.payoutDestination === "WALLET" ? "accent" : "neutral"} className="w-fit">
                {entry.payoutDestination === "WALLET" ? "Wallet" : "Bank"}
              </Badge>
              {entry.payoutDestination === "WALLET" ? (
                <span className="text-[11px] font-medium text-text-faint">
                  {formatNaira(entry.walletBalance)} already in wallet
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </Card>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-text-soft">
          Total if everyone shown is included: <span className="font-extrabold text-text">{formatNaira(totalIfAllSelected)}</span>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/payments/batches">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create batch"}
          </Button>
        </div>
      </div>
    </form>
  );
}
