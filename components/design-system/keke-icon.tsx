import { cn } from "@/lib/utils";

interface KekeIconProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * The tricycle (keke) silhouette used across the sidebar mark, fleet cards,
 * and the Login/KYC hero panels. Kept as one shared component so every
 * screen renders the exact same icon.
 */
export function KekeIcon({ className, color = "currentColor", strokeWidth = 1.8 }: KekeIconProps) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 17h16M6 17V9.5a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73V17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="19.5" r="1.5" fill={color} />
      <circle cx="15.5" cy="19.5" r="1.5" fill={color} />
    </svg>
  );
}

/**
 * The larger, more detailed tricycle silhouette used as a low-opacity
 * watermark on dark hero panels (Login, KYC).
 */
export function KekeWatermark({ className, opacity = 0.12 }: { className?: string; opacity?: number }) {
  return (
    <svg
      className={className}
      style={{ opacity }}
      viewBox="0 0 260 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="70" cy="165" r="24" stroke="white" strokeWidth="3" />
      <circle cx="210" cy="165" r="20" stroke="white" strokeWidth="3" />
      <rect x="40" y="95" width="150" height="60" rx="12" stroke="white" strokeWidth="3" />
      <path d="M40,95 C50,40 140,40 155,60 L175,95" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M155,60 L155,95" stroke="white" strokeWidth="3" />
      <rect x="175" y="115" width="40" height="40" rx="8" stroke="white" strokeWidth="3" />
      <path d="M195,115 L205,75" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <path d="M190,75 L220,75" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
