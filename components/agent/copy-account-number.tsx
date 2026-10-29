"use client";

import { useState } from "react";

/**
 * Small clipboard helper for the agent's Paystack collection account
 * number. Clipboard access can be blocked by the browser (an iframe
 * preview, a permission denial), in which case the copy silently does
 * nothing and the account number is still shown as plain text right next
 * to it, so nothing is ever hidden behind a button that might not work.
 */
export function CopyAccountNumber({ accountNumber }: { accountNumber: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable or denied, nothing to do, the number is
      // already visible as plain text for a manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-text-soft transition-colors hover:bg-background"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 5 5L20 7" stroke="var(--good-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-good-ink">Copied</span>
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}
