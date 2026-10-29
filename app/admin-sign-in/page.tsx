"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

import { KekeWatermark } from "@/components/design-system/keke-icon";
import { AuthHeroBackground } from "@/components/auth/auth-hero-carousel";
import { verifyAdminAccess } from "@/lib/actions/auth";

// This page deliberately lives at /admin-sign-in, a sibling of app/admin/
// rather than a child of it (app/admin/sign-in would inherit
// app/admin/layout.tsx, which redirects anyone not already signed in
// straight to /sign-in before this page ever gets a chance to render,
// making it permanently unreachable). Living outside app/admin/ avoids
// that layout entirely.

/**
 * A separate sign-in page for the platform owner, kept apart from the
 * shared /sign-in page that staff and investors use. This is not
 * a second authentication system, it is the same Supabase Auth password
 * sign-in, verifyAdminAccess just checks afterward that the account
 * holds the Admin role and refuses (with a sign-out) if it doesn't, so an
 * ordinary staff account landing on this page by mistake, or a bookmark
 * being shared around, doesn't quietly work the same as the real thing.
 *
 * 2026-10-26: the on-page copy used to also mention "agents" here, left
 * over from before agent/driver self-service sign-in was removed
 * (client-decisions-log.md decision #1, lib/config/portal-access.ts) —
 * corrected since agents/drivers no longer sign themselves in anywhere,
 * staff handle their accounts instead.
 */
export default function AdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Module 30: same two-factor challenge as /sign-in, see that page's own
  // comment. The Admin account is exactly the kind of account where this
  // matters most, worth double checking it actually works here too rather
  // than assuming the shared page covers it.
  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function completeSignIn() {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setError("This sign-in is for the Admin account only. Staff and investors should use /sign-in.");
      return;
    }

    setIsSubmitting(false);
    router.push("/admin/dashboard");
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      if (factorsError || !factor) {
        setIsSubmitting(false);
        setError("Could not start your two-factor check, try again.");
        return;
      }
      setMfaFactorId(factor.id);
      setIsSubmitting(false);
      setStage("mfa");
      return;
    }

    await completeSignIn();
  }

  async function handleMfaVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaFactorId) return;
    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeError) {
      setIsSubmitting(false);
      setError(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    if (verifyError) {
      setIsSubmitting(false);
      setError("That code didn't match, check the time on your phone is correct and try again.");
      return;
    }

    await completeSignIn();
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
      <AuthHeroBackground />
      <div className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-3xl bg-surface p-8 shadow-card animate-card-in">
        <KekeWatermark className="pointer-events-none absolute -right-14 -top-10 h-[160px] w-[210px]" opacity={0.05} />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white shadow-sm ring-1 ring-border">
            <img src="/brand/icon.png" alt="" className="h-[19px] w-auto" />
          </div>
          {/* Module 60: text-brand (the logo's blue) is safe here since
              this card is always a light `bg-surface` plate in both
              themes (see globals.css's own comment on --brand), same
              reasoning as the sidebar. Left as single-line "Ultimate
              Admin", not split into the "Ultimate Fleet"/"Logistics"
              two-line lockup used elsewhere — that wording is
              deliberately distinct from the brand name, it's what
              tells staff they're on the owner-only sign-in, not the
              shared /sign-in page, and splitting it into the lockup
              shape would blur that signal. */}
          <span className="text-[17px] font-bold text-brand">Ultimate Admin</span>
        </div>

        <div className="relative z-10 mt-6">
          {stage === "mfa" ? (
            <>
              <div className="text-[21px] font-extrabold tracking-tight">Enter your code</div>
              <div className="mt-1.5 text-[13px] text-text-soft">
                Open your authenticator app and enter the 6-digit code it shows.
              </div>

              <form onSubmit={handleMfaVerify} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mfa-code">6-digit code</Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                  />
                </div>

                {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

                <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
                  {isSubmitting ? "Verifying..." : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStage("credentials");
                    setMfaCode("");
                    setError(null);
                  }}
                >
                  Back
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-[21px] font-extrabold tracking-tight">Admin sign in</div>
              <div className="mt-1.5 text-[13px] text-text-soft">
                This is the owner account, staff and investors sign in at{" "}
                <span className="font-semibold">/sign-in</span> instead.
              </div>

              <form onSubmit={handleSignIn} className="mt-6 flex flex-col gap-4">
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                  />
                </div>

                <div className="flex justify-end text-[12.5px]">
                  <Link href="/forgot-password" className="font-semibold text-accent-dark">
                    Forgot password?
                  </Link>
                </div>

                {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

                <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="mt-6 text-center text-[12px] text-text-faint">
                Setting this deployment up for the first time?{" "}
                <Link href="/setup" className="font-semibold text-accent-dark">
                  Create the first Admin account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
