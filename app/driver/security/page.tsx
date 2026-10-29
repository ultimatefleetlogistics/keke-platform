import { redirect } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneSettingsForm } from "@/components/account/phone-settings-form";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Round ten, direct ask: "the driver should have his/her own profile
 * settings, for changing his phone number, etc." This page already
 * existed (Module 24's driver portal shell already linked "Security" in
 * its sidebar nav), but only ever had the two-factor authentication
 * card, missing the same "Phone number" and "Password" cards
 * `/investor/security` got in Module 39. Nothing new to build for either,
 * `updateOwnPhone` (`lib/actions/auth.ts`) and `PhoneSettingsForm`
 * (`components/account/phone-settings-form.tsx`) were already
 * portal-agnostic, and `/change-password` already works for any signed-in
 * account, this just wires the same two cards in here too, identical
 * copy to the investor page, mirrored exactly for consistency. Agent had
 * the exact same gap, see `app/agent/security/page.tsx`, fixed the same
 * way in the same round.
 */
export default async function DriverSecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Security</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Your phone number, and two-factor authentication for your own account.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="max-w-[560px] p-6">
          <div className="mb-1 text-[13.5px] font-extrabold">Phone number</div>
          <div className="mb-4 text-[12.5px] text-text-soft">
            Used for payment and security alerts by text message. Your email address is your sign in and can&apos;t
            be changed here, contact an administrator if it needs to change.
          </div>
          <PhoneSettingsForm currentPhone={user.phone} />
        </Card>

        <Card className="max-w-[560px] p-6">
          <div className="mb-1 text-[13.5px] font-extrabold">Password</div>
          <div className="mb-4 text-[12.5px] text-text-soft">
            Changed from a dedicated page so it works the same way whether it&apos;s voluntary or a forced first
            change on a new account.
          </div>
          <Link href="/change-password" className="text-[13px] font-bold text-accent-dark hover:underline">
            Change your password →
          </Link>
        </Card>

        <Card className="max-w-[560px] p-6">
          <div className="mb-4 text-[13.5px] font-extrabold">Two-factor authentication</div>
          <MfaSettings />
        </Card>
      </div>
    </>
  );
}
