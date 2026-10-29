"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { changePassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Split out from app/change-password/page.tsx (a Server Component) since
 * this needs "use client" for the form state, the page itself resolves
 * mustChangePassword and homePath server-side and passes them in as
 * props.
 */
export function ChangePasswordForm({ homePath, isForced }: { homePath: string; isForced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Those new passwords don't match.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);

    const result = await changePassword(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push(homePath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">{isForced ? "Temporary password" : "Current password"}</Label>
        <Input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••••"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Type it again"
        />
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

      <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
        {isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
