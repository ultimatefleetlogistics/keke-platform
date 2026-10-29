import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { KekeIcon, KekeWatermark } from "@/components/design-system/keke-icon";
import { SetupForm } from "./setup-form";

// This page deliberately lives outside app/admin/ and app/(auth)-style
// groupings, same reasoning as /admin-sign-in: it must be reachable by
// someone who is not signed in and holds no permission, since its entire
// purpose is creating the account that would otherwise be required to
// reach it. See bootstrapFirstAdmin in lib/actions/auth.ts for the actual
// gating (a database-wide zero-staff check plus a SETUP_BOOTSTRAP_KEY
// secret), this Server Component just decides which of three states to
// render so a visitor finds out why before filling out a form, not after
// submitting it.

/**
 * One-time bootstrap for the very first Admin account on a fresh
 * deployment. Module 25, see the doc comment on bootstrapFirstAdmin for
 * the full reasoning. Documented in README.md's "Running this locally"
 * section, and linked in small print at the bottom of /admin-sign-in for
 * whoever is standing up a new deployment and doesn't already know the
 * URL, not something surfaced anywhere a day-to-day staff, agent,
 * investor, or driver would ever see it.
 */
export default async function SetupPage() {
  const setupKeyConfigured = Boolean(process.env.SETUP_BOOTSTRAP_KEY);
  const staffCount = setupKeyConfigured ? await prisma.staffProfile.count() : 0;
  const alreadyCompleted = setupKeyConfigured && staffCount > 0;

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#1F1A12] px-6 py-10">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-surface p-8 shadow-card">
        <KekeWatermark className="pointer-events-none absolute -right-14 -top-10 h-[160px] w-[210px]" opacity={0.05} />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
            <KekeIcon className="h-[18px] w-[18px]" color="white" />
          </div>
          <span className="text-[17px] font-bold">Ultimate Setup</span>
        </div>

        {!setupKeyConfigured ? (
          <div className="relative z-10 mt-6">
            <div className="text-[21px] font-extrabold tracking-tight">Setup key not configured</div>
            <div className="mt-2 text-[13px] leading-5 text-text-soft">
              This deployment has no <span className="font-semibold">SETUP_BOOTSTRAP_KEY</span> environment
              variable set, so first-run setup stays disabled. Set one (any long random string) in your environment
              variables, redeploy, and come back to this page.
            </div>
          </div>
        ) : alreadyCompleted ? (
          <div className="relative z-10 mt-6">
            <div className="text-[21px] font-extrabold tracking-tight">Setup already completed</div>
            <div className="mt-2 text-[13px] leading-5 text-text-soft">
              A staff account already exists on this deployment, so this page won&apos;t create another Admin. Sign
              in at <span className="font-semibold">/admin-sign-in</span> if you&apos;re the owner, or ask whoever
              holds that account to create yours from Settings &gt; Staff instead.
            </div>
            <Button className="mt-5 w-full" asChild>
              <Link href="/admin-sign-in">Go to admin sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="relative z-10 mt-6">
            <div className="text-[21px] font-extrabold tracking-tight">Create the first Admin account</div>
            <div className="mt-1.5 text-[13px] leading-5 text-text-soft">
              This deployment has no staff account yet. This creates one with the full owner-tier Admin role, the
              account everything else, including every other staff account, gets created from. This page
              permanently stops working the moment it succeeds.
            </div>
            <SetupForm />
          </div>
        )}
      </div>
    </div>
  );
}
