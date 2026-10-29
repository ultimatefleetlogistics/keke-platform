"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { VehicleType } from "@prisma/client";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/utils";
import { fundVehicleFromWallet } from "@/lib/actions/wallet";
import type { DefaultContractTerms } from "@/lib/vehicle-types";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

function todayInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Same shape as app/admin/contracts/new/new-contract-form.tsx, minus the
 * investor picker (locked to whoever this page is for) and with the
 * principal amount clamped to what their wallet actually holds, this
 * screen can never submit a principal larger than the balance being
 * converted, the server action re-checks the same thing regardless.
 */
export function FundVehicleForm({
  investorId,
  walletBalance,
  vehicles,
  defaultTermsByType,
}: {
  investorId: string;
  walletBalance: number;
  vehicles: { id: string; type: VehicleType; label: string }[];
  defaultTermsByType: Record<VehicleType, DefaultContractTerms>;
}) {
  const vehicleTypeById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.type])), [vehicles]);
  const initialType: VehicleType = vehicles[0]?.type ?? "KEKE";
  const [terms, setTerms] = useState<DefaultContractTerms>({
    ...defaultTermsByType[initialType],
    principalAmount: Math.min(defaultTermsByType[initialType].principalAmount, walletBalance),
  });

  function handleVehicleChange(vehicleId: string) {
    const type = vehicleTypeById.get(vehicleId);
    if (type) {
      setTerms({ ...defaultTermsByType[type], principalAmount: Math.min(defaultTermsByType[type].principalAmount, walletBalance) });
    }
  }

  const remaining = walletBalance - terms.principalAmount;

  return (
    <ActionForm action={fundVehicleFromWallet} className="flex flex-col gap-4">
      <input type="hidden" name="investorId" value={investorId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vehicleId">Vehicle</Label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          defaultValue=""
          onChange={(e) => handleVehicleChange(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Select a vehicle
          </option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="principalAmount">Amount to convert from wallet (NGN)</Label>
          <Input
            id="principalAmount"
            name="principalAmount"
            type="number"
            step="0.01"
            min="1"
            max={walletBalance}
            value={terms.principalAmount}
            onChange={(e) => setTerms((t) => ({ ...t, principalAmount: Number(e.target.value) }))}
            required
          />
          <div className={`text-[12px] font-semibold ${remaining < 0 ? "text-bad-ink" : "text-text-soft"}`}>
            {remaining < 0
              ? `${formatNaira(Math.abs(remaining))} more than this investor's wallet holds`
              : `${formatNaira(remaining)} would remain in the wallet after this`}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetPayoutAmount">Target payout amount (NGN)</Label>
          <Input
            id="targetPayoutAmount"
            name="targetPayoutAmount"
            type="number"
            step="0.01"
            min="1"
            value={terms.targetPayoutAmount}
            onChange={(e) => setTerms((t) => ({ ...t, targetPayoutAmount: Number(e.target.value) }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="installmentAmount">Installment amount (NGN)</Label>
          <Input
            id="installmentAmount"
            name="installmentAmount"
            type="number"
            step="0.01"
            min="1"
            value={terms.installmentAmount}
            onChange={(e) => setTerms((t) => ({ ...t, installmentAmount: Number(e.target.value) }))}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="termMonths">Term (months)</Label>
          <Input
            id="termMonths"
            name="termMonths"
            type="number"
            min="1"
            max="25"
            value={terms.termMonths}
            onChange={(e) => setTerms((t) => ({ ...t, termMonths: Number(e.target.value) }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentFrequency">Payment frequency</Label>
          <select
            id="paymentFrequency"
            name="paymentFrequency"
            value={terms.paymentFrequency}
            onChange={(e) =>
              setTerms((t) => ({ ...t, paymentFrequency: e.target.value as DefaultContractTerms["paymentFrequency"] }))
            }
            className={SELECT_CLASS}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Biweekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={todayInputValue()} required />
        </div>
      </div>

      <div className="mt-1.5 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" asChild>
          <Link href="/admin/wallet/funding">Cancel</Link>
        </Button>
        <ActionSubmitButton className="flex-[2]" disabled={remaining < 0}>
          Fund this vehicle
        </ActionSubmitButton>
      </div>
    </ActionForm>
  );
}
