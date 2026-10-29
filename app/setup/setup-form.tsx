"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { bootstrapFirstAdmin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Split out from app/setup/page.tsx (a Server Component) purely because
 * the interactive form needs "use client", the zero-staff/setup-key
 * gating that decides whether this even renders happens server-side in
 * the page itself, this component assumes it has already passed.
 */
export function SetupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("fullName", fullName);
    formData.set("email", email);
    formData.set("password", password);
    formData.set("setupKey", setupKey);

    const result = await bootstrapFirstAdmin(formData);
    if (result.error) {
      setIsSubmitting(false);
      setError(result.error);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      // The account exists now even though signing straight in failed, an
      // odd network blip most likely, send them to sign in by hand rather
      // than leaving them stuck on this form.
      router.push("/admin-sign-in");
      return;
    }

    router.push("/admin/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amaka Obi" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
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
      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <Label htmlFor="setupKey">Setup key</Label>
        <Input
          id="setupKey"
          type="password"
          required
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value)}
          placeholder="SETUP_BOOTSTRAP_KEY from the environment"
        />
        <div className="text-[11.5px] text-text-faint">
          Whoever configured this deployment&apos;s environment variables set this, not your own password.
        </div>
      </div>

      {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

      <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
        {isSubmitting ? "Creating the Admin account..." : "Create the Admin account"}
      </Button>
    </form>
  );
}
