"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KekeIcon, KekeWatermark } from "@/components/design-system/keke-icon";

/**
 * Where the link Supabase emails from /forgot-password actually lands.
 * The recovery token travels in the URL itself, Supabase's browser client
 * reads it out and briefly establishes a session for exactly this one
 * action, we never see or handle the token directly. That read happens
 * asynchronously, so this page waits for it (via onAuthStateChange, plus
 * a one-time getSession check in case it already resolved before this
 * component mounted) rather than assuming a session is already there.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
      }
      setChecking(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setIsSubmitting(false);
      setError(updateError.message);
      return;
    }

    // Round seven ("fix the password stuff"), closing the real half of
    // the gap CURRENT_STATE.md's Known gaps section used to describe as
    // "no way to revoke other sessions on a password reset." This is
    // exactly the moment that matters most: someone landed here because
    // they lost control of their password (forgot it, or worse, someone
    // else had it), and the whole point of resetting it is that whatever
    // device or browser was signed in on the old password shouldn't stay
    // signed in. The recovery session Supabase just established for this
    // page (see the file comment above) is a real, live session for this
    // account, so `signOut({ scope: 'others' })` here revokes every
    // *other* session for this user without touching this one, then the
    // existing `signOut()` right below ends this one too, same as
    // before. Best-effort and non-blocking on purpose: if this specific
    // call fails for any reason, the password itself is already changed
    // successfully, that must not be undone or blocked by a session
    // clean-up step failing.
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});

    // Sign back out right away. The rest of this app treats signing in
    // with your credentials as the only way into the dashboard (see
    // /sign-in and /admin-sign-in), a session left over from clicking a
    // reset link shouldn't quietly double as being signed in.
    await supabase.auth.signOut();
    setIsSubmitting(false);
    setDone(true);
    setTimeout(() => router.push("/sign-in"), 2500);
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6">
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-surface p-8 shadow-card">
        <KekeWatermark className="pointer-events-none absolute -right-14 -top-10 h-[160px] w-[210px]" opacity={0.05} />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
            <KekeIcon className="h-[18px] w-[18px]" color="white" />
          </div>
          <span className="text-[17px] font-bold">Ultimate</span>
        </div>

        <div className="relative z-10 mt-6">
          {checking ? (
            <div className="py-6 text-center text-[13px] text-text-soft">Checking your link...</div>
          ) : done ? (
            <div className="rounded-xl bg-good-soft px-4 py-3.5 text-[12.5px] font-semibold text-good-ink">
              Password updated. Redirecting you to sign in...
            </div>
          ) : !hasSession ? (
            <>
              <div className="text-[21px] font-extrabold tracking-tight">Link invalid or expired</div>
              <div className="mt-1.5 text-[13px] text-text-soft">
                Reset links only work once and expire after a while. Request a new one from{" "}
                <Link href="/forgot-password" className="font-semibold text-accent-dark">
                  Forgot password
                </Link>
                .
              </div>
            </>
          ) : (
            <>
              <div className="text-[21px] font-extrabold tracking-tight">Set a new password</div>
              <div className="mt-1.5 text-[13px] text-text-soft">Choose something you haven&apos;t used here before.</div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">New password</Label>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
