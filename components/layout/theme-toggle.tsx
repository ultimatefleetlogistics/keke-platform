"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ultimate-theme";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// The `beforeInteractive` script in app/layout.tsx already set this
// attribute before this component ever mounts; reading it back (rather
// than re-deriving from localStorage/matchMedia here) is what keeps this
// button in sync with whatever that script actually decided, including
// its localStorage-then-OS-preference fallback order, without
// duplicating that logic a second time.
function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// Used only for the server-rendered markup and the very first client
// render before hydration settles; useSyncExternalStore swaps to the
// real getSnapshot() value right after, with no manual "mounted" flag
// and no hydration-mismatch warning, that swap is exactly what this hook
// is designed to do for state that lives outside React.
function getServerSnapshot(): Theme {
  return "light";
}

/**
 * Module 42: direct feedback, "add toggle for light/dark mode on both
 * apps." One button, sun/moon glyph, flips `data-theme` on `<html>` and
 * remembers the choice in localStorage; the actual color values live in
 * app/globals.css (`[data-theme="dark"]`), this component only ever
 * touches the attribute, never a color.
 *
 * Reads its state with `useSyncExternalStore` rather than
 * `useState`/`useEffect`: the real value lives on the DOM (an external
 * system, set by the init script before this ever mounts), and
 * `toggle()` mutates that same external value directly, so this is
 * exactly the "subscribe to an external store" case the hook exists
 * for, not local component state. It also avoids a lint rule
 * (react-hooks/set-state-in-effect) that flags a mount-time useEffect
 * whose only job is calling setState, which is what an earlier version
 * of this component did.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled: the toggle still works for
      // this page view, it just won't be remembered next visit.
    }
    notifyListeners();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      className={
        className ??
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-soft transition-colors hover:bg-background hover:text-text"
      }
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3.5a8.5 8.5 0 1 0 8.5 9.9A7 7 0 0 1 12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.8v2.4M12 18.8v2.4M4.2 12H1.8M22.2 12h-2.4M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
