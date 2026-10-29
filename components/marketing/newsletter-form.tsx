"use client";

import { useState, type FormEvent } from "react";

/**
 * Module: public homepage, footer. 2026-10-22: there's no real mailing
 * list / subscriber backend yet (no Resend audience, no DB table for
 * this) — building one is separate work. Rather than fake a "Thanks,
 * you're subscribed!" success state that doesn't actually subscribe
 * anyone anywhere, submitting here opens the visitor's own mail client
 * with a pre-filled message to CONTACT_EMAIL asking to be added. It's a
 * real, honest mechanism in the meantime, not a placeholder that lies
 * about what it does. Swap for a real subscribe endpoint once one
 * exists.
 */
export function NewsletterForm({ contactEmail }: { contactEmail: string }) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const subject = encodeURIComponent("Newsletter signup");
    const body = encodeURIComponent(`Please add this email to your updates list: ${email.trim()}`);
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email address"
        aria-label="Your email address"
        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-accent px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-accent-dark"
        aria-label="Subscribe for updates"
      >
        &rarr;
      </button>
    </form>
  );
}
