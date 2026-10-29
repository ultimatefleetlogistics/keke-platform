"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActionResult = { error?: string } | void;

/**
 * Module 59: the dispute/adjustment tool, one row at a time — "staff
 * needs a way to investigate and, where justified, make a manual ledger
 * adjustment with a reason attached" (missing-features-agent-driver-
 * restructure.md item 5). Collapsed to a single small link by default so
 * every remittance/deposit row doesn't carry a permanently visible
 * destructive action; expands to a reason field in place, inline, rather
 * than navigating away, since the row it applies to should stay in view
 * while staff type the reason. See lib/actions/manual-payments.ts's
 * reversePaymentTransaction for what this actually does.
 */
export function ReversePaymentButton({
  paymentTransactionId,
  action,
}: {
  paymentTransactionId: string;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="text-[11px] font-semibold text-text-faint">Reversed</span>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-bold text-bad-ink hover:underline">
        Reverse
      </button>
    );
  }

  async function handleReverse() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("paymentTransactionId", paymentTransactionId);
    formData.set("reason", reason.trim());
    const result = await action(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-bad-soft bg-bad-soft/40 p-2">
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why is this being reversed?"
        className="h-8 text-[11.5px]"
      />
      {error ? <div className="text-[10.5px] font-medium text-bad-ink">{error}</div> : null}
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="destructive" disabled={isSubmitting} loading={isSubmitting} onClick={handleReverse} className="h-7 px-2.5 text-[11px]">
          Confirm reversal
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isSubmitting} onClick={() => setOpen(false)} className="h-7 px-2.5 text-[11px]">
          Cancel
        </Button>
      </div>
    </div>
  );
}
