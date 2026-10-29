"use client";

import { useState } from "react";
import type { VehicleType } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

/**
 * Pairs the vehicle type picker with the asset tag field so picking a type
 * fills in the suggested next tag for that type (KKE-005, CAR-003,
 * BIKE-003, whatever is next for the type chosen). `suggestions` is
 * computed server-side by getNextAssetTagsByType (lib/data/fleet.ts) from
 * the highest tag already on file per prefix. If the admin types over the
 * suggestion themselves, further type changes stop overwriting it, an
 * intentional non-default asset tag never gets silently replaced by
 * switching the dropdown back and forth.
 */
export function VehicleTypeAndTagFields({ suggestions }: { suggestions: Record<VehicleType, string> }) {
  const [type, setType] = useState<VehicleType>("KEKE");
  const [assetTag, setAssetTag] = useState(suggestions.KEKE);
  const [tagTouched, setTagTouched] = useState(false);

  function handleTypeChange(nextType: VehicleType) {
    setType(nextType);
    if (!tagTouched) {
      setAssetTag(suggestions[nextType]);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Vehicle type</Label>
        <select
          id="type"
          name="type"
          required
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as VehicleType)}
          className="flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
        >
          {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assetTag">Asset tag</Label>
        <Input
          id="assetTag"
          name="assetTag"
          required
          value={assetTag}
          onChange={(e) => {
            setAssetTag(e.target.value);
            setTagTouched(true);
          }}
        />
        <span className="text-[11.5px] text-text-faint">
          Suggested from the last {VEHICLE_TYPE_LABELS[type].toLowerCase()} on file. Change it if this one needs a
          different tag.
        </span>
      </div>
    </div>
  );
}
