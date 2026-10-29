"use client";

import { useState } from "react";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeroCarousel, VEHICLE_PHOTOS, type AuthSlide } from "@/components/auth/auth-hero-carousel";

const SLIDES: AuthSlide[] = [
  {
    ...VEHICLE_PHOTOS[0],
    headline: "We'll get you back in.",
    subhead: "Enter the email on your keke investment account and we'll send a link to set a new password.",
  },
  {
    ...VEHICLE_PHOTOS[1],
    headline: "We'll get you back in.",
    subhead: "Enter the email on your bike investment account and we'll send a link to set a new password.",
  },
  {
    ...VEHICLE_PHOTOS[2],
    headline: "We'll get you back in.",
    subhead: "Enter the email on your car investment account and we'll send a link to set a new password.",
  },
];

/**
 * Requests a password reset email through Supabase Auth. On success we
 * always show the same "check your email" message whether or not that
 * address actually has an account, so this page can't be used to find out
 * which emails are registered. The actual reset happens at
 * /reset-password, the link Supabase emails points there.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsSubmitting(false);

    // Show the same outcome either way, see the file comment above.
    if (resetError && resetError.status && resetError.status >= 500) {
      setError("Something went wrong on our end, try again in a moment.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <div className="hidden w-[560px] shrink-0 lg:flex">
        <AuthHeroCarousel
          slides={SLIDES}
          logo={
            // Module 60: see the identical comment in
            // app/sign-up/page.tsx — reviving globals.css's already-
            // written but never-applied slide-in-left/right pair.
            <div className="flex items-center gap-2.5 animate-slide-in-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white">
                <img src="/brand/icon.png" alt="" className="h-[18px] w-auto" />
              </div>
              {/* Module 60: white, not brand-blue — see the identical
                  comment in app/sign-up/page.tsx, same dark-photo-backed
                  carousel, same reasoning. */}
              <div className="flex flex-col">
                <div className="whitespace-nowrap text-[15px] font-bold">Ultimate Fleet</div>
                <div className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.03em] text-white/70 [text-align-last:justify] [text-justify:inter-character]">
                  Logistics
                </div>
              </div>
            </div>
          }
          footer={<div className="text-xs text-[#BFE7CE]">© 2026 Ultimate, Keke Investment and Fleet Management</div>}
        />
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="w-full max-w-[380px] animate-slide-in-right">
          <div className="text-[25px] font-extrabold tracking-tight">Reset your password</div>
          <div className="mt-1.5 text-[13.5px] text-text-soft">
            We&apos;ll email you a link to set a new one.
          </div>

          {sent ? (
            <div className="mt-7 rounded-xl bg-good-soft px-4 py-3.5 text-[12.5px] font-semibold text-good-ink">
              If an account exists for {email}, a reset link is on its way. It expires after a while, so use it
              soon.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
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

              {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

              <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-[12.5px] text-text-faint">
            <Link href="/sign-in" className="font-semibold text-accent-dark">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
