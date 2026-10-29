"use client";

import { useState } from "react";

import { updateOwnPhone } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneFieldIcon } from "@/components/design-system/settings-icons";

/**
 * Round twelve: the row half of the Personal data group's Phone number
 * entry, direct feedback asking the web app to match keke-mobile's own
 * new grouped Profile tab (see `components/design-system/settings-list.tsx`'s
 * own comment). GTBank's own Personal data section is plain read-only
 * display, no inline edit control, so this renders the current phone
 * number as a normal row (icon, value, "Phone number" caption) and
 * expands `PhoneSettingsForm` below it, in the same row's card, only
 * when clicked, rather than always showing the form the way this screen
 * used to. A chevron that rotates open/closed is the only affordance
 * needed, `PhoneSettingsForm` itself is completely unchanged below.
 */
export function PhoneNumberRow({ currentPhone }: { currentPhone: string | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-background"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-accent">
          <PhoneFieldIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold">{currentPhone ?? "Not on file"}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-text-faint">Phone number</div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-text-faint transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded ? (
        <div className="border-t border-border px-4 py-4">
          <PhoneSettingsForm currentPhone={currentPhone} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Module 39: the web counterpart to keke-mobile's Security screen "Phone
 * number" card, same reasoning, same field, no email edit anywhere near
 * it. `currentPhone` comes from the server page (`getCurrentUser()`),
 * this only needs "use client" for the form's own submit/error state, the
 * same split `ChangePasswordForm` already uses.
 */
export function PhoneSettingsForm({ currentPhone }: { currentPhone: string | null }) {
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty = phone.trim() !== (currentPhone ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Enter a phone number.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("phone", trimmed);
    const result = await updateOwnPhone(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSuccess(false);
          }}
          placeholder="e.g. 08012345678"
          className="max-w-xs"
        />
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {success ? <div className="text-[12.5px] font-medium text-good-ink">Your phone number was updated.</div> : null}

      <Button type="submit" size="sm" disabled={isSubmitting || !dirty} loading={isSubmitting} className="w-fit">
        {isSubmitting ? "Saving..." : "Save phone number"}
      </Button>
    </form>
  );
}
