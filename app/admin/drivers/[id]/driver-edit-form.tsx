"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateDriver } from "@/lib/actions/drivers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

export function DriverEditForm({
  driverId,
  fullName,
  email,
  hasAppAccess,
  phone,
  agentId,
  agents,
}: {
  driverId: string;
  fullName: string;
  email: string;
  hasAppAccess: boolean;
  phone: string;
  agentId: string;
  agents: Array<{ id: string; label: string }>;
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
    const result = await updateDriver(formData);
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
      <input type="hidden" name="driverId" value={driverId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </div>
      {hasAppAccess ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={email} required />
          <div className="text-[11.5px] text-text-faint">This is also what they sign in with.</div>
        </div>
      ) : (
        <div className="text-[11.5px] text-text-faint">
          This driver has no app account, there is no email to edit. Drivers created going forward always get one.
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" name="phone" defaultValue={phone} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agentId">Reports to agent</Label>
        <select id="agentId" name="agentId" required defaultValue={agentId} className={SELECT_CLASS}>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
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
