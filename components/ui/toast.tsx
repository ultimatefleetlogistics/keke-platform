"use client";

import type { ReactNode } from "react";

const VARIANT_STYLES: Record<"good" | "warn" | "accent", { badgeBg: string; badgeText: string; border: string }> = {
  good: { badgeBg: "bg-good", badgeText: "text-white", border: "border-good/25" },
  warn: { badgeBg: "bg-warn", badgeText: "text-white", border: "border-warn/25" },
  accent: { badgeBg: "bg-accent-soft", badgeText: "text-accent-dark", border: "border-border" },
};

type ToastProps = {
  variant: "good" | "warn" | "accent";
  icon: ReactNode;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  delayMs?: number;
};

/**
 * A floating notification, fixed to the corner of the viewport rather than
 * sitting in the normal page flow, see app/kyc/identity-form.tsx for the
 * first real use. The point of a toast over an inline banner is that it
 * shows up wherever the person already is, they never have to scroll to
 * find out something just happened.
 */
export function Toast({ variant, icon, title, children, onDismiss, delayMs = 0 }: ToastProps) {
  const styles = VARIANT_STYLES[variant];
  return (
    <div
      className={`animate-card-in pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-2xl border ${styles.border} bg-surface p-4 shadow-card-hover`}
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.badgeBg} ${styles.badgeText}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-extrabold">{title}</div>
        <div className="mt-0.5 text-[12.5px] text-text-soft">{children}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-faint hover:bg-background hover:text-text"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Fixed container every Toast renders into: top center on small screens
 * (so it's never off to a side you have to notice on a narrow phone
 * screen), top right from `sm` up. `pointer-events-none` on the
 * container with `pointer-events-auto` on each Toast itself means the
 * empty space around a toast never blocks clicking whatever is
 * underneath it.
 */
export function ToastStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2.5 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {children}
    </div>
  );
}
