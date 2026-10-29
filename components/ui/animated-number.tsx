"use client";

import { useEffect, useRef, useState } from "react";

import { formatNaira } from "@/lib/utils";

function formatCompactNaira(amount: number): string {
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2)}M`;
  return formatNaira(amount);
}

export type AnimatedNumberFormat = "count" | "naira" | "compactNaira";

const FORMATTERS: Record<AnimatedNumberFormat, (value: number) => string> = {
  count: (n) => Math.round(n).toString(),
  naira: formatNaira,
  compactNaira: formatCompactNaira,
};

/**
 * Module 50: direct feedback, make the app feel more premium. A number
 * that snaps straight to its final value on load reads as static data
 * dumped on screen; the better fintech dashboards (and this app's own
 * shimmer skeletons, entrance animations elsewhere in globals.css) treat
 * the first paint as a moment worth a little motion. This counts up from
 * 0 to `value` with an ease-out curve (fast start, gentle settle, the
 * same easing family the rest of this app already uses, never linear,
 * which reads as mechanical) rather than snapping.
 *
 * `format` is a NAME, not a function reference: the pages that render
 * this are Server Components (app/admin/dashboard/page.tsx and friends),
 * and a Server Component can't hand a Client Component an actual
 * function prop — Next.js can't serialize a closure across that
 * boundary and throws ("Functions cannot be passed directly to Client
 * Components...") the moment it tries. Picking the formatter by name
 * INSIDE this file, from a fixed lookup table, keeps every prop crossing
 * that boundary a plain string/number, while pages still get to choose
 * naira vs. compact-naira vs. a plain count. `formatCompactNaira` here
 * is the same logic app/admin/dashboard/page.tsx defined locally before
 * this fix (kept in sync deliberately, not imported from that page,
 * since a page file isn't something a component should import from).
 *
 * Re-animates from whatever was last on screen (not from 0 again) if
 * `value` changes after mount, e.g. a wallet balance updating after an
 * action, so a live change still reads as "this number moved" rather
 * than restarting from zero. Skips the animation entirely under
 * `prefers-reduced-motion: reduce`, jumping straight to the final value.
 */
export function AnimatedNumber({
  value,
  format = "count",
  duration = 900,
}: {
  value: number;
  format?: AnimatedNumberFormat;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const formatFn = FORMATTERS[format];

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return <>{formatFn(display)}</>;
}
