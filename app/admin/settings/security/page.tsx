import { redirect } from "next/navigation";

import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneNumberRow } from "@/components/account/phone-settings-form";
import { LockFieldIcon, MailFieldIcon, ProfileFieldIcon } from "@/components/design-system/settings-icons";
import { SettingsGroup, SettingsRow, SettingsSectionLabel } from "@/components/design-system/settings-list";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Unlike every other tile on /admin/settings, this one isn't gated by a
 * manage-permission, it's about the signed-in staff or Admin's own
 * account, not something they administer for someone else. Every staff,
 * agent, or Admin account reaching /admin/settings can turn this on for
 * themselves, see components/account/mfa-settings.tsx for the shared
 * implementation this and the investor/agent/driver portals' own
 * settings pages all use.
 *
 * Round ten: this was the last of the four portal security pages still
 * missing the "Phone number" and "Password" cards `/investor/security`
 * (now `/investor/settings`) got in Module 39, closing the same gap
 * `/agent/settings` and `/driver/settings` had (see their own comments,
 * the direct ask that started this was specifically about the driver
 * portal, staff/admin had the identical gap sitting right next to it).
 *
 * Round eleven renamed the investor, agent, and driver pages from
 * `/security` to `/settings` and their sidebar nav labels from
 * "Security" to "Settings" (see `app/driver/settings/page.tsx`'s own
 * comment). This page kept its own `/admin/settings/security` path and
 * "Security" header unchanged: it already lived inside the "Settings"
 * hub at `/admin/settings` as one tile among several, exactly the shape
 * the other three portals' single settings page now also matches.
 *
 * Round twelve: rebuilt around `SettingsGroup`/`SettingsRow`
 * (`components/design-system/settings-list.tsx`), same change as the
 * other three portals' settings pages, see `app/driver/settings/page.tsx`'s
 * own comment for the full reasoning. Full name and Email are new rows
 * here too, "Security" stays the header (unchanged from round eleven,
 * this page already lives inside the "Settings" hub), the body now
 * reads "Personal data" then "Security" the same as the other three.
 *
 * Module 44 follow-up: the two `SettingsGroup` cards were a fixed
 * `max-w-[560px]` column pinned to the left edge, leaving a large dead
 * gap on wider screens, "it doesnt look good." Fixed the same way
 * `app/investor/settings/page.tsx` was (see that page's own comment for
 * the full reasoning): a responsive `lg:grid-cols-2`, one card per
 * column at `lg` and up, still a single stacked column below it.
 */
export default async function AdminSecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Security</div>
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
