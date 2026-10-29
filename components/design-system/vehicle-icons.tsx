import type { VehicleType } from "@prisma/client";

import { cn } from "@/lib/utils";
import { KekeIcon } from "@/components/design-system/keke-icon";

interface VehicleTypeIconProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * Car and bike siblings of KekeIcon, same 24x24 viewBox and line weight so
 * a fleet list mixing all three vehicle types reads as one icon family
 * rather than three mismatched styles. KekeIcon itself is untouched and
 * stays the app's brand mark (sidebar, sign in, KYC hero panels), these
 * two are only for telling vehicle types apart in the fleet list and
 * anywhere a specific vehicle is shown.
 */
export function CarIcon({ className, color = "currentColor", strokeWidth = 1.8 }: VehicleTypeIconProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 16.2v-3.1a2 2 0 0 1 .47-1.29l1.72-2.02a2 2 0 0 1 1.53-.71h7.56a2 2 0 0 1 1.53.71l1.72 2.02a2 2 0 0 1 .47 1.29v3.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 16.2h15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="8" cy="17.6" r="1.5" fill={color} />
      <circle cx="16" cy="17.6" r="1.5" fill={color} />
    </svg>
  );
}

export function BikeIcon({ className, color = "currentColor", strokeWidth = 1.8 }: VehicleTypeIconProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.5 17 10 10h3.5L15.5 17M10 10h4.5l2 3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="17" r="2.6" stroke={color} strokeWidth={strokeWidth} />
      <circle cx="15.5" cy="17" r="2.6" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

/**
 * Renders the right icon for a vehicle's type. This renders directly
 * rather than handing back a component reference to render elsewhere,
 * since picking a component dynamically and assigning it to a variable
 * (e.g. `const Icon = ...`) resets that icon's state on every render and
 * trips the static-components lint rule, use this component instead.
 */
export function VehicleTypeIcon({ type, className, color, strokeWidth }: VehicleTypeIconProps & { type: VehicleType }) {
  if (type === "CAR") return <CarIcon className={className} color={color} strokeWidth={strokeWidth} />;
  if (type === "BIKE") return <BikeIcon className={className} color={color} strokeWidth={strokeWidth} />;
  return <KekeIcon className={className} color={color} strokeWidth={strokeWidth} />;
}
