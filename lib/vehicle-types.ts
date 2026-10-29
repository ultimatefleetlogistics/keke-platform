import type { VehicleType } from "@prisma/client";

/**
 * Everything that varies by vehicle type lives here: the label shown in the
 * UI, and the contract terms a new contract pre-fills once that vehicle is
 * selected. These are starting points only, every field on
 * InvestmentContract can still be edited per contract (see
 * prisma/schema.prisma), a car costing more than the default below doesn't
 * need a code change, just a different number typed into the form.
 *
 * The KEKE numbers are the real, company-confirmed figures (see "Locked
 * business rules" in docs/architecture/CURRENT_STATE.md). The CAR and BIKE
 * numbers below are placeholders I picked to be roughly proportionate,
 * nobody at the company has confirmed real car or bike figures yet. Treat
 * them as a starting point to replace, not as a second locked rule, and
 * update this comment once real numbers come in.
 */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  KEKE: "Keke",
  CAR: "Car",
  BIKE: "Bike",
};

export const VEHICLE_TYPES: VehicleType[] = ["KEKE", "CAR", "BIKE"];

/**
 * The asset tag prefix used for each vehicle type, e.g. a keke's tag reads
 * "KKE-001", a car's "CAR-001", a bike's "BIKE-001" (see prisma/seed-demo.ts
 * for the real records these were seeded with). Used to auto-suggest the
 * next asset tag on /admin/fleet/new, see getNextAssetTagsByType in
 * lib/data/fleet.ts.
 */
export const ASSET_TAG_PREFIXES: Record<VehicleType, string> = {
  KEKE: "KKE",
  CAR: "CAR",
  BIKE: "BIKE",
};

/**
 * The SystemSetting key a vehicle type's default contract terms are stored
 * under once an admin overrides them from /admin/settings/contract-terms.
 * See lib/data/onboarding.ts, getEffectiveVehicleTypeDefaults, for how an
 * override is merged with the fallback below.
 */
export function contractTermsSettingKey(type: VehicleType): string {
  return `default_contract_terms_${type.toLowerCase()}`;
}

export type DefaultContractTerms = {
  principalAmount: number;
  targetPayoutAmount: number;
  installmentAmount: number;
  paymentFrequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  termMonths: number;
};

export const VEHICLE_TYPE_DEFAULT_TERMS: Record<VehicleType, DefaultContractTerms> = {
  KEKE: {
    principalAmount: 3_850_000,
    targetPayoutAmount: 6_500_000,
    installmentAmount: 65_000,
    paymentFrequency: "WEEKLY",
    termMonths: 25,
  },
  // Placeholder, not yet confirmed by the company, see the file comment above.
  CAR: {
    principalAmount: 9_000_000,
    targetPayoutAmount: 15_000_000,
    installmentAmount: 150_000,
    paymentFrequency: "WEEKLY",
    termMonths: 25,
  },
  // Placeholder, not yet confirmed by the company, see the file comment above.
  BIKE: {
    principalAmount: 1_200_000,
    targetPayoutAmount: 2_000_000,
    installmentAmount: 25_000,
    paymentFrequency: "WEEKLY",
    termMonths: 25,
  },
};
