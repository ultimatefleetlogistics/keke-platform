import { redirect } from "next/navigation";

import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneNumberRow } from "@/components/account/phone-settings-form";
import { LockFieldIcon, MailFieldIcon, ProfileFieldIcon } from "@/components/design-system/settings-icons";
import { SettingsGroup, SettingsRow, SettingsSectionLabel } from "@/components/design-system/settings-list";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Round ten: had the exact same gap the driver page did (direct ask,
 * see `app/driver/settings/page.tsx`'s own comment for the full
 * reasoning), only ever showing the two-factor authentication card.
 * Same fix, same two cards, identical to `/investor/settings` and
 * `/driver/settings`: `updateOwnPhone`/`PhoneSettingsForm` and
 * `/change-password` were already portal-agnostic, nothing new to build.
 *
 * Round eleven: renamed from `/agent/security` to `/agent/settings`,
 * and the sidebar nav label from "Security" to "Settings" to match,
 * same reasoning as `app/driver/settings/page.tsx`: the nav tab should
 * read "Settings," with "security" (the two-factor authentication card
 * below) living inside it rather than being the whole page's name.
 *
 * Round twelve: rebuilt around `SettingsGroup`/`SettingsRow`, same
 * change as `app/driver/settings/page.tsx`, see that page's own comment
 * for the full reasoning. Full name and Email are new rows here too.
 *
 * Module 44 follow-up: the two `SettingsGroup` cards were a fixed
 * `max-w-[560px]` column pinned to the left edge, leaving a large dead
 * gap on wider screens, "it doesnt look good." Fixed the same way
 * `app/investor/settings/page.tsx` was (see that page's own comment for
 * the full reasoning): a responsive `lg:grid-cols-2`, one card per
 * column at `lg` and up, still a single stacked column below it.
 */
export default async function AgentSettingsPage() {
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
