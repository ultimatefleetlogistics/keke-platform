import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Base shimmering placeholder block, see the `.skeleton` animation in
 * app/globals.css. Every loading.tsx in the app composes this into a
 * rough outline of the real page, matched closely enough in size and
 * layout that the swap from skeleton to real content doesn't jump.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-lg", className)} {...props} />;
}

export { Skeleton };
