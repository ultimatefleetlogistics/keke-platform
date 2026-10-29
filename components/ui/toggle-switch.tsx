"use client";

import { cn } from "@/lib/utils";

/**
 * Round twelve: the web counterpart to keke-mobile's `ToggleSwitch`
 * (`src/components/toggle-switch.tsx`), same reasoning: direct
 * feedback, "our 2fa should mimick there [GTBank's], is should like a
 * toggle," and the web app's own two-factor authentication setting
 * (`components/account/mfa-settings.tsx`) used to be a plain "Turn on"
 * button with no on/off visual at all. A real `<button role="switch">`,
 * not a checkbox styled to look like one: `aria-checked` communicates
 * state to assistive tech directly, and it composes as a normal click
 * handler the same as every other button in this app, no hidden native
 * input to keep in sync. `checked`/`onCheckedChange` mirror the shape
 * of every other controlled input already used across this codebase
 * (see `Input`, `components/ui/input.tsx`) rather than inventing a new
 * naming convention.
 */
export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "relative h-[26px] w-[44px] shrink-0 rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-border bg-background",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-[20px] w-[20px] -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-150",
          checked ? "translate-x-[21px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}
