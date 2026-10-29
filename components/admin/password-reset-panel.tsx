"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ResetResult = { error?: string; temporaryPassword?: string };

/**
 * Shared by the investor, driver, and staff/agent edit pages: "admin/
 * assigned staff should be able to manage investor, agents, drivers and
 * staff accounts this include changing their password." One generic
 * panel rather than three near-identical Client Components, the only
 * thing that differs per account type is which Server Action it calls and
 * which hidden field name that action expects (`investorId`, `driverId`,
 * or `userId`), both passed in as props. Next.js Server Actions are
 * serializable, passing one down from a Server Component parent as a
 * prop, rather than importing it directly here, is supported and exactly
 * what makes this shareable across three differently-shaped actions.
 *
 * Deliberately does not claim to sign the person out of any session
 * already open elsewhere, `supabase.auth.admin.updateUserById` changes
 * the password but does not revoke an existing session on its own, only
 * a fresh sign-in needs the new password.
 */
export function PasswordResetPanel({
  action,
  idFieldName,
  idValue,
  subjectLabel,
}: {
  action: (formData: FormData) => Promise<ResetResult>;
  idFieldName: string;
  idValue: string;
  subjectLabel: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set(idFieldName, idValue);
    const result = await action(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setTemporaryPassword(result.temporaryPassword ?? null);
  }

  if (temporaryPassword) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-semibold text-warn-ink">
          This password is shown once and cannot be retrieved again. Share it with {subjectLabel} directly, they
          will be asked to choose their own the next time they sign in.
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">New temporary password</div>
          <div className="mt-0.5 text-[15px] font-bold tracking-wide">{temporaryPassword}</div>
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setTemporaryPassword(null)}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[12.5px] text-text-soft">
        Generates a brand new random password for {subjectLabel}, useful if they have lost access or forgotten
        theirs. Their old password stops working the moment this is generated.
      </div>
      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          loading={isSubmitting}
          onClick={handleReset}
        >
          {isSubmitting ? "Generating..." : "Generate new password"}
        </Button>
      </div>
    </div>
  );
}
