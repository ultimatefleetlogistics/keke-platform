"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateStaffOrAgentAccount } from "@/lib/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Module 51: staff-only now, agent's own equivalent is
// app/admin/agents/[id]/agent-edit-form.tsx, see lib/data/agents.ts's
// own comment for why they were split. Still submits to
// updateStaffOrAgentAccount, unchanged there, this form just no longer
// carries the accountType branch or the region field an agent needs and
// a staff account never did.
export function StaffEditForm({
  userId,
  fullName,
  email,
  phone,
  jobTitle,
}: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await updateStaffOrAgentAccount(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={email} required />
        <div className="text-[11.5px] text-text-faint">This is also what they sign in with.</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="jobTitle">Job title (optional)</Label>
        <Input id="jobTitle" name="jobTitle" defaultValue={jobTitle} placeholder="Operations Manager" />
      </div>
      <div className="text-[11.5px] text-text-faint">
        Roles are managed separately, from Roles &amp; permissions.
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}
      {saved && !error ? <div className="text-[12.5px] font-medium text-good-ink">Saved.</div> : null}

      <div className="mt-1.5">
        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
