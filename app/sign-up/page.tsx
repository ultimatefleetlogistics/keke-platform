import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter, CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { isPublicSignupEnabled } from "@/lib/config/portal-access";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Get Access | Ultimate Fleet Logistics",
  description: "How accounts are set up at Ultimate Fleet Logistics.",
};

/**
 * 2026-11-22: this route is now a thin server wrapper. The real sign-up
 * form lives in ./sign-up-form.tsx, completely unchanged, and is shown
 * only when PUBLIC_SIGNUP_ENABLED="true" (see isPublicSignupEnabled in
 * lib/config/portal-access.ts for the why). Otherwise visitors, and any
 * link still pointing here, see how accounts are actually set up. This
 * has to be a server component because the flag is a server-side
 * environment variable, the form itself is a Client Component.
 */
export default function SignUpPage() {
  if (isPublicSignupEnabled()) {
    return <SignUpForm />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-xl px-5 py-20 sm:py-28">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent-dark">Get access</p>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-text sm:text-[34px]">
            Accounts are created by invitation
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-soft">
            Ultimate Fleet Logistics sets up each account itself, after speaking with you. If you are an existing
            client or partner who hasn&apos;t received your sign-in details yet, or you would like to find out more,
            get in touch and our team will help.
          </p>

          <div className="mt-8 space-y-2 rounded-xl border border-border bg-surface p-5 text-[14.5px]">
            <a href={`mailto:${CONTACT_EMAIL}`} className="block font-semibold text-accent-dark hover:underline">
              {CONTACT_EMAIL}
            </a>
            <a href="tel:+2349019505552" className="block text-text-soft hover:underline">
              0901 950 5552
            </a>
            <a href="tel:+2348039392901" className="block text-text-soft hover:underline">
              0803 939 2901
            </a>
          </div>

          <p className="mt-8 text-[13.5px] text-text-faint">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-semibold text-accent-dark">
              Sign in
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
