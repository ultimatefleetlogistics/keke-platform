import { cn } from "@/lib/utils";

interface StatIconProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * Module 42: the investor dashboard's four stat cards (Total invested,
 * Total realized, Outstanding, Active investments) all shared one
 * generic, meaningless icon before this, a plain vertical line
 * (`<path d="M12 2v20" />`) recolored per card, functionally a
 * placeholder that was never replaced. Direct feedback: these "are not
 * having real meaningful icons... find suitable icons that doesn't look
 * too AI." These four are each drawn to actually depict what the card
 * means rather than an abstract stroke, same 24x24 viewBox and line
 * weight as `vehicle-icons.tsx`'s `CarIcon`/`BikeIcon` so the whole icon
 * family still reads as one set.
 */
export function InvestedIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A stacked coin cylinder with the top ellipse open: money going in and
  // building up, the plainest way to draw "capital committed" without
  // reaching for an arrow-into-a-box cliche.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="6.2" rx="7" ry="2.7" stroke={color} strokeWidth={strokeWidth} />
      <path
        d="M5 6.2v5.4c0 1.5 3.13 2.7 7 2.7s7-1.2 7-2.7V6.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M5 11.6V17c0 1.5 3.13 2.7 7 2.7s7-1.2 7-2.7v-5.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RealizedIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A coin landing in a tray, arrow pointing down: money that has already
  // come back, the opposite direction of InvestedIcon's build-up.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M8 9l4 4.2L16 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.5 14.8h15V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-4.2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OutstandingIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A plain clock: what's still outstanding is what hasn't come due yet.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12.8" r="8" stroke={color} strokeWidth={strokeWidth} />
      <path d="M12 8.3v4.8l3.2 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 2.3h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function PortfolioIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A briefcase: a portfolio of active contracts, not a single vehicle,
  // which is what the previous generic "house" glyph misleadingly
  // suggested (this app doesn't finance real estate).
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="7.8" width="17" height="11.2" rx="2.2" stroke={color} strokeWidth={strokeWidth} />
      <path
        d="M8.5 7.8V6.2a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 13h17" stroke={color} strokeWidth={strokeWidth} />
      <rect x="10.4" y="11.6" width="3.2" height="2.8" rx="0.6" fill={color} />
    </svg>
  );
}

/**
 * Module 42 (follow-up): the admin dashboard's seven stat cards (Total
 * vehicles, Active fleet, In maintenance, Investment value, Inflow this
 * month, Outflow this month, Net this month) all reused `KekeIcon`, the
 * app's own logo mark, recolored per card, direct feedback: "the icons
 * you use on the dashboard...are the same one you use for the app icon
 * or logo, find something befitting and replace." These six join
 * `InvestedIcon` above (reused as-is for "Investment value," the same
 * coin-stack metaphor genuinely fits both), same 24x24 viewBox and line
 * weight as the rest of this file.
 */
export function FleetIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A plain side-view car silhouette: "total vehicles" spans keke, bike,
  // and car, so a specific vehicle-type glyph (see vehicle-icons.tsx)
  // would misrepresent a mixed fleet, a generic car shape reads as
  // "vehicle" in general without claiming to be any one type.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 15.5v-2.3a2 2 0 0 1 .34-1.1l2.1-3.2A2 2 0 0 1 8.1 8h7.8a2 2 0 0 1 1.66.9l2.1 3.2c.22.34.34.73.34 1.1v2.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15.5h16v2.3a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-1H7.3v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path d="M6.5 12h11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="8" cy="15.5" r="1.4" fill={color} />
      <circle cx="16" cy="15.5" r="1.4" fill={color} />
    </svg>
  );
}

export function ActiveFleetIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A speedometer, needle mid-sweep: distinct from FleetIcon's plain
  // count, this one reads as "currently running," not just "on the
  // books."
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 15.5a8 8 0 1 1 16 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path d="M12 15.5 15.5 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.3" fill={color} />
      <path d="M6 15.5h.01M18 15.5h.01M12 7.5h.01" stroke={color} strokeWidth={strokeWidth + 0.4} strokeLinecap="round" />
    </svg>
  );
}

export function MaintenanceIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A wrench: the one glyph this always meant, no reason to be clever.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.7 9.3a4 4 0 0 1-5.4 5.4L4.5 19.5a1.5 1.5 0 0 1-2-2l4.8-4.8a4 4 0 0 1 5.4-5.4l-2.7 2.7 1.2 1.2 2.7-2.7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InflowIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // An arrow sweeping down into a baseline: money arriving, paired
  // visually with OutflowIcon's mirrored arrow leaving the same
  // baseline, so the two read as opposites at a glance.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4v10.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M7.5 11l4.5 4.5L16.5 11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19h15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function OutflowIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // InflowIcon flipped vertically: money leaving the same baseline,
  // same construction, opposite direction.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20V9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M7.5 13l4.5-4.5L16.5 13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 5h15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function NetIcon({ className, color = "currentColor", strokeWidth = 1.8 }: StatIconProps) {
  // A balance scale: net is inflow weighed against outflow, the one
  // card of the three that is a comparison rather than a single
  // direction of money movement.
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.5v15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M4.5 18.5h15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M4.5 7h6.5M13 7h6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path
        d="M4.5 7 2.3 11.3a2.4 2.4 0 0 0 4.4 0L4.5 7ZM19.5 7l-2.2 4.3a2.4 2.4 0 0 0 4.4 0L19.5 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
