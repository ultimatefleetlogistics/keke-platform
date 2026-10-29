"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VehicleType } from "@prisma/client";

import { updateDepositIntent } from "@/lib/actions/investor-profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VEHICLE_TYPE_LABELS, VEHICLE_TYPES } from "@/lib/vehicle-types";

const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

/**
 * Module 41: an investor's own standing answer to "what is a deposit into
 * your account for", direct feedback: "ask investor if he wants to fund
 * his wallet or he wants to purchase the vehicle straight away". This is
 * a preference, not a one-off choice, it applies to every deposit until
 * changed again here, see updateDepositIntent's own doc comment for why:
 * choosing "toward a vehicle" flags the deposit for staff to act on
 * quickly, it never creates a contract by itself, a staff member always
 * still decides that from /admin/wallet/funding.
 */
export function DepositIntentForm({
  currentIntent,
  currentVehicleType,
}: {
  currentIntent: "WALLET_TOPUP" | "VEHICLE_PURCHASE";
  currentVehicleType: VehicleType | null;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState(currentIntent);
  const [vehicleType, setVehicleType] = useState<VehicleType>(currentVehicleType ?? "KEKE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = intent !== currentIntent || (intent === "VEHICLE_PURCHASE" && vehicleType !== currentVehicleType);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await updateDepositIntent(formData);
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
        <Label>What are deposits for?</Label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="depositIntent"
            value="WALLET_TOPUP"
            checked={intent === "WALLET_TOPUP"}
            onChange={() => setIntent("WALLET_TOPUP")}
            className="mt-0.5 h-4 w-4 border-border accent-accent"
          />
          <span className="text-[13.5px] font-semibold text-text">Add to my wallet</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="radio"
            name="depositIntent"
            value="VEHICLE_PURCHASE"
            checked={intent === "VEHICLE_PURCHASE"}
            onChange={() => setIntent("VEHICLE_PURCHASE")}
            className="mt-0.5 h-4 w-4 border-border accent-accent"
          />
          <span className="text-[13.5px] font-semibold text-text">I&apos;m depositing to buy a vehicle</span>
        </label>
        <div className="text-[11.5px] text-text-faint">
          Either way, money lands in your wallet the moment it arrives, same as any deposit. Choosing a vehicle
          purchase just flags it for our team to act on quickly instead of it sitting as plain balance, they&apos;ll
          be in touch to set up the contract.
        </div>
      </div>

      {intent === "VEHICLE_PURCHASE" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vehicleType">Which vehicle type?</Label>
          <select
            id="vehicleType"
            name="vehicleType"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className={SELECT_CLASS}
          >
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {VEHICLE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {saved && !error ? <div className="text-[12.5px] font-medium text-good-ink">Saved.</div> : null}

      <Button type="submit" disabled={isSubmitting || !dirty} loading={isSubmitting} variant="outline" className="w-fit">
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
