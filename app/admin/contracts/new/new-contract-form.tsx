"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { VehicleType } from "@prisma/client";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvestmentContract } from "@/lib/actions/contracts";
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
 * Client component only because the numeric terms need to react to which
 * vehicle gets picked, a car should suggest different numbers than a bike
 * or a keke, see lib/vehicle-types.ts. Every field stays fully editable
 * after that, this only decides what pre-fills.
 */
export function NewContractForm({
  investors,
  vehicles,
  defaultTermsByType,
}: {
  investors: { id: string; label: string }[];
  vehicles: { id: string; type: VehicleType; label: string }[];
  defaultTermsByType: Record<VehicleType, DefaultContractTerms>;
}) {
  const vehicleTypeById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.type])), [vehicles]);
  const initialType: VehicleType = vehicles[0]?.type ?? "KEKE";
  const [terms, setTerms] = useState<DefaultContractTerms>(defaultTermsByType[initialType]);

  function handleVehicleChange(vehicleId: string) {
    const type = vehicleTypeById.get(vehicleId);
    if (type) setTerms(defaultTermsByType[type]);
  }

  return (
    <ActionForm action={createInvestmentContract} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="investorId">Investor</Label>
          <select id="investorId" name="investorId" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              Select an investor
            </option>
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.label}
              </option>
            ))}
          </select>
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="principalAmount">Principal amount (NGN)</Label>
          <Input
            id="principalAmount"
            name="principalAmount"
            type="number"
            step="0.01"
            min="1"
            value={terms.principalAmount}
            onChange={(e) => setTerms((t) => ({ ...t, principalAmount: Number(e.target.value) }))}
            required
          />
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
          <Link href="/admin/investors">Cancel</Link>
        </Button>
        <ActionSubmitButton className="flex-[2]">Create contract</ActionSubmitButton>
      </div>
    </ActionForm>
  );
}
