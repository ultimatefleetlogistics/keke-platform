"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signUpInvestor } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthHeroCarousel, VEHICLE_PHOTOS, type AuthSlide } from "@/components/auth/auth-hero-carousel";

const SLIDES: AuthSlide[] = [
  {
    ...VEHICLE_PHOTOS[0],
    headline: "Own a keke without owning the headache.",
    subhead: "Fund a tricycle, get paid weekly as it earns, take ownership at target payout.",
  },
  {
    ...VEHICLE_PHOTOS[1],
    headline: "Own a bike without owning the headache.",
    subhead: "Fund a motorcycle, get paid weekly as it earns, take ownership at target payout.",
  },
  {
    ...VEHICLE_PHOTOS[2],
    headline: "Own a car without owning the headache.",
    subhead: "Fund a commercial car, get paid weekly as it earns, take ownership at target payout.",
  },
];

const BULLETS = [
  "Real-time visibility into your investment and every payment",
  "Automatic ownership transfer once your target payout is reached",
];

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(event: React.FormEvent) {
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
    formData.set("phone", phone);
    formData.set("password", password);

    const result = await signUpInvestor(formData);
    if (result.error) {
      setIsSubmitting(false);
      setError(result.error);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      // The account exists now even though signing straight in failed
      // (an odd network blip, most likely), send them to sign in by hand
      // rather than leaving them stuck on this form.
      router.push("/sign-in");
      return;
    }

    router.push("/kyc");
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      <div className="hidden w-[560px] shrink-0 lg:flex">
        <AuthHeroCarousel
          slides={SLIDES}
          bullets={BULLETS}
          logo={
            // Module 60: `animate-slide-in-left` already existed in
            // globals.css (Module 42, "cool animations... login in,
            // login out") but was never actually applied anywhere in
            // this codebase — the logo, and the form column below,
            // both used to just appear on page load with no entrance
            // at all. Wiring up the animation that was already written
            // for exactly this, rather than inventing a new one.
            <div className="flex items-center gap-2.5 animate-slide-in-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white">
                <img src="/brand/icon.png" alt="" className="h-[18px] w-auto" />
              </div>
              {/* Module 60: white, not the sidebar's brand-blue token —
                  this sits directly on AuthHeroCarousel's dark photo
                  wash (`text-white` on its wrapper, see that component's
                  own comment: "dark wash so white text stays legible
                  over any part of any photo"), where a photo's local
                  brightness is unpredictable. Blue measures fine against
                  this app's own fixed dark tokens but was never tested
                  against arbitrary photo content, and isn't worth
                  gambling legibility on here. */}
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

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-[380px] animate-slide-in-right">
          <div className="text-[25px] font-extrabold tracking-tight">Create your account</div>
          <div className="mt-1.5 text-[13.5px] text-text-soft">Start your investment in a few minutes</div>

          <form onSubmit={handleSignUp} className="mt-7 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Amaka Obi"
              />
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
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." />
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

            {error ? <div className="text-[12.5px] font-medium text-bad-ink">{error}</div> : null}

            <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
              {isSubmitting ? "Creating your account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-[12.5px] text-text-faint">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-accent-dark">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
