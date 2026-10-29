"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeroBackground } from "@/components/auth/auth-hero-carousel";
import { verifyAdminAccess, resolvePortalDestination, checkMagicLinkBlocked } from "@/lib/actions/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Module 30: whether the account that just entered its password also
  // has two-factor authentication turned on (see components/account/
  // mfa-settings.tsx, where it's turned on). When it does, the password
  // alone only gets an "aal1" session, `stage` switches to "mfa" and
  // everything below (the Admin check, portal routing) waits until the
  // 6-digit code is verified too, an enrolled factor that's never
  // actually challenged would just be theater.
  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  /**
   * Round nine: no more "Investor" / "Staff / Agent / Driver" tab
   * deciding where sign-in lands, see resolvePortalDestination's own
   * comment (lib/actions/auth.ts) for why that tab was actually a soft
   * bug, not just an unnecessary extra click. This now resolves the
   * account's real portal directly, the same way for every account type,
   * whatever credentials were actually typed.
   */
  async function completeSignIn(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
    // The Admin account signs in at /admin-sign-in instead, kept separate
    // from everyone else's sign-in so day to day staff, agent, and
    // investor access is never mixed up with the one account that can
    // change roles and system wide settings.
    const { isAdmin } = await verifyAdminAccess();
    if (isAdmin) {
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setError("This is the Admin account, sign in at /admin-sign-in instead.");
      return;
    }

    const destination = await resolvePortalDestination();
    setIsSubmitting(false);
    if ("error" in destination) {
      await supabase.auth.signOut();
      setError(destination.error);
      return;
    }
    router.push(destination.path);
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

    await completeSignIn(supabase);
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

    await completeSignIn(supabase);
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    setIsSubmitting(true);
    setError(null);

    // Checked before the link is even sent, not after it's clicked: an
    // account with two-factor authentication turned on skips it entirely
    // and needs the password + code path above instead, see
    // checkMagicLinkBlocked's own doc comment for why this is the fix
    // rather than an AAL check after the redirect.
    const { blocked, reason } = await checkMagicLinkBlocked(email);
    if (blocked) {
      setIsSubmitting(false);
      setError(reason ?? "This account can't sign in with a magic link.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: linkError } = await supabase.auth.signInWithOtp({ email });

    setIsSubmitting(false);
    setError(linkError ? linkError.message : "Check your email for a sign in link.");
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-10">
      <AuthHeroBackground />

      {/* Module 60: two real text lines, not the raster lockup image —
          "Ultimate Fleet" stays white (this sits directly on
          AuthHeroBackground's dark-washed photo, whose local brightness
          varies, so white is the one color proven safe over "any part
          of any photo", not the sidebar's brand-blue token, which was
          never tested against unpredictable photo content). LOGISTICS
          is justified to the width of the line above it via
          text-align-last/text-justify, same technique as the sidebar,
          not a hand-picked letter-spacing number. `animate-slide-in-left`
          was already defined in globals.css (Module 42) but had never
          actually been applied to this logo — it just appeared instantly
          while the card below it faded in with `animate-card-in`, direct
          feedback that the logo "shouldn't just stay static" caught
          exactly that gap. */}
      <div className="absolute left-6 top-6 z-10 flex items-center gap-2.5 sm:left-10 sm:top-10 animate-slide-in-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white">
          <img src="/brand/icon.png" alt="" className="h-[18px] w-auto" />
        </div>
        <div className="flex flex-col">
          <div className="whitespace-nowrap text-[15px] font-bold text-white">Ultimate Fleet</div>
          <div className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.03em] text-white/70 [text-align-last:justify] [text-justify:inter-character]">
            Logistics
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[400px] animate-card-in overflow-hidden rounded-3xl border border-white/15 bg-white/[0.08] p-8 shadow-[0_25px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {stage === "mfa" ? (
          <>
            <div className="text-[21px] font-extrabold tracking-tight text-white">Enter your code</div>
            <div className="mt-1.5 text-[13px] text-white/65">
              Open your authenticator app and enter the 6-digit code it shows.
            </div>

            <form onSubmit={handleMfaVerify} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfa-code" className="text-white/85">
                  6-digit code
                </Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-accent focus:bg-white/15 focus:ring-accent/25"
                />
              </div>

              {error ? <div className="text-[12.5px] font-medium text-[#FFB4A8]">{error}</div> : null}

              <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-white/70 hover:bg-white/10 hover:text-white"
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
            <div className="text-[25px] font-extrabold tracking-tight text-white">Sign in</div>
            <div className="mt-1.5 text-[13.5px] text-white/65">Enter your details to access your dashboard</div>

            <form onSubmit={handleSignIn} className="mt-7 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-white/85">
                  Email or phone number
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-accent focus:bg-white/15 focus:ring-accent/25"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-white/85">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-accent focus:bg-white/15 focus:ring-accent/25"
                />
              </div>

              <div className="flex items-center justify-between text-[12.5px]">
                <label className="flex items-center gap-1.5 font-medium text-white/70">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-white/30 bg-white/10" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="font-semibold text-accent">
                  Forgot password?
                </Link>
              </div>

              {error ? <div className="text-[12.5px] font-medium text-[#FFB4A8]">{error}</div> : null}

              <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
                {isSubmitting ? "Signing in..." : "Continue"}
              </Button>

              <div className="my-0.5 flex items-center gap-2.5">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-[11.5px] font-medium text-white/45">or</span>
                <div className="h-px flex-1 bg-white/15" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleMagicLink}
                disabled={isSubmitting}
                className="border-white/20 bg-white/5 text-white hover:bg-white/15"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Send a login link by email
              </Button>
            </form>
          </>
        )}

        <div className="mt-6 text-center text-[12.5px] text-white/60">
          New investor?{" "}
          <Link href="/sign-up" className="font-semibold text-accent">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
