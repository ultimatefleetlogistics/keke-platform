import { redirect } from "next/navigation";

import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneNumberRow } from "@/components/account/phone-settings-form";
import { LockFieldIcon, MailFieldIcon, ProfileFieldIcon } from "@/components/design-system/settings-icons";
import { SettingsGroup, SettingsRow, SettingsSectionLabel } from "@/components/design-system/settings-list";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Round ten, direct ask: "the driver should have his/her own profile
 * settings, for changing his phone number, etc." This page already
 * existed (Module 24's driver portal shell already linked "Security" in
 * its sidebar nav), but only ever had the two-factor authentication
 * card, missing the same "Phone number" and "Password" cards
 * `/investor/settings` got in Module 39. Nothing new to build for either,
 * `updateOwnPhone` (`lib/actions/auth.ts`) and `PhoneSettingsForm`
 * (`components/account/phone-settings-form.tsx`) were already
 * portal-agnostic, and `/change-password` already works for any signed-in
 * account, this just wires the same two cards in here too, identical
 * copy to the investor page, mirrored exactly for consistency. Agent had
 * the exact same gap, see `app/agent/settings/page.tsx`, fixed the same
 * way in the same round.
 *
 * Round eleven: renamed from `/driver/security` to `/driver/settings`,
 * and the sidebar nav label from "Security" to "Settings" to match,
 * direct feedback that the nav tab should read "Settings," with
 * "security" (the two-factor authentication card below) living inside
 * it rather than being the whole page's name, exactly what this page
 * had already become the moment the Phone number and Password cards
 * landed above, just not renamed to say so yet.
 *
 * Round twelve: rebuilt around `SettingsGroup`/`SettingsRow`
 * (`components/design-system/settings-list.tsx`), direct feedback after
 * keke-mobile's own Profile tab got the same treatment: "you should do
 * something similar to the web app, make it as beutiful as the mobile
 * too, group them accordinly when one click on profile like that." Full
 * name and Email are new here, plain read-only rows the way GTBank's own
 * Personal data section shows them, this page never had them at all
 * before. Phone number is now `PhoneNumberRow`, a row that expands the
 * same `PhoneSettingsForm` in place instead of always showing it, and
 * Two-factor authentication is now a `ToggleSwitch` row
 * (`components/ui/toggle-switch.tsx`) via the rebuilt `MfaSettings`
 * (`components/account/mfa-settings.tsx`), matching keke-mobile's own
 * toggle. Three separate bordered `Card`s became two rounded
 * `SettingsGroup`s of dividered rows, "Personal data" and "Security."
 *
 * Module 44 follow-up: the two `SettingsGroup` cards were a fixed
 * `max-w-[560px]` column pinned to the left edge, leaving a large dead
 * gap on wider screens, "it doesnt look good." Fixed the same way
 * `app/investor/settings/page.tsx` was (see that page's own comment for
 * the full reasoning): a responsive `lg:grid-cols-2`, one card per
 * column at `lg` and up, still a single stacked column below it.
 */
export default async function DriverSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Settings</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Your name, phone number, password, and two-factor authentication for your own account.
        </div>
      </header>

      <div className="grid grid-cols-1 gap-x-6 px-8 py-6 lg:grid-cols-2 lg:items-start">
        <div>
          <SettingsSectionLabel>Personal data</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<ProfileFieldIcon />} primary={user.fullName} secondary="Full name" />
            <PhoneNumberRow currentPhone={user.phone} />
            <SettingsRow icon={<MailFieldIcon />} primary={user.email} secondary="Email" />
          </SettingsGroup>
        </div>

        <div>
          <SettingsSectionLabel>Security</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow
              icon={<LockFieldIcon />}
              primary="Password"
              secondary="Change your password"
              href="/change-password"
            />
            <MfaSettings />
          </SettingsGroup>
        </div>
      </div>
    </>
  );
}
