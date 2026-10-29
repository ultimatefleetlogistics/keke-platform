"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

type ActionResult = { error?: string } | void;

/**
 * Module 59: staff recording a cash remittance/deposit, see
 * lib/actions/manual-payments.ts's recordManualPayment for the full
 * reasoning. The vehicle dropdown is optional on purpose, same "Not yet
 * allocated" fallback the remittance/deposit history tables already show
 * for any transaction with no allocations, staff can record the money now
 * and sort out which vehicle it belongs to later.
 */
export function ManualPaymentForm({
  subjectType,
  subjectId,
  vehicles,
  action,
}: {
  subjectType: "AGENT" | "DRIVER";
  subjectId: string;
  vehicles: Array<{ id: string; assetTag: string }>;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount received (NGN)</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" placeholder="15000" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vehicleId">Applies to vehicle (optional)</Label>
          <select id="vehicleId" name="vehicleId" defaultValue="" className={SELECT_CLASS}>
            <option value="">Not yet allocated</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.assetTag}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason">Reason / how it was received</Label>
        <Input id="reason" name="reason" placeholder="Cash handed to field officer at Kano depot, 26 Sep" required />
      </div>
      {error ? <div className="text-[12px] font-medium text-bad-ink">{error}</div> : null}
      {done && !error ? <div className="text-[12px] font-medium text-good-ink">Recorded.</div> : null}
      <div>
        <Button type="submit" size="sm" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Recording..." : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
