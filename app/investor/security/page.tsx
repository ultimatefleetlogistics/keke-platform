import { redirect } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneSettingsForm } from "@/components/account/phone-settings-form";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Module 39 adds the "Phone number" card above two-factor authentication:
 * the same "under the settings user should be able to update phone number
 * but not email address" request that added the equivalent card to
 * keke-mobile's Security screen. Password change deliberately stays where
 * it already lived, `/change-password` (linked from AppShell, see that
 * page's own comment), rather than being duplicated here, this page adds
 * only what didn't already exist somewhere on the web app.
 */
export default async function InvestorSecurityPage() {
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
