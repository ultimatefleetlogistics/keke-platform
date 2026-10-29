import { redirect } from "next/navigation";

import { MfaSettings } from "@/components/account/mfa-settings";
import { PhoneNumberRow } from "@/components/account/phone-settings-form";
import {
  BankFieldIcon,
  DocumentFieldIcon,
  LockFieldIcon,
  MailFieldIcon,
  ProfileFieldIcon,
} from "@/components/design-system/settings-icons";
import { SettingsGroup, SettingsRow, SettingsSectionLabel } from "@/components/design-system/settings-list";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Module 39 adds the "Phone number" card above two-factor authentication:
 * the same "under the settings user should be able to update phone number
 * but not email address" request that added the equivalent card to
 * keke-mobile's Security screen. Password change deliberately stays where
 * it already lived, `/change-password` (linked from AppShell, see that
 * page's own comment), rather than being duplicated here, this page adds
 * only what didn't already exist somewhere on the web app.
 *
 * Round eleven: renamed from `/investor/security` to `/investor/settings`,
 * and the sidebar nav label from "Security" to "Settings" to match,
 * direct feedback that the nav tab should read "Settings," with
 * "security" (the two-factor authentication card below) living inside
 * it rather than being the whole page's name. This was the original
 * page the driver and agent settings pages (`app/driver/settings/page.tsx`,
 * `app/agent/settings/page.tsx`) were modeled on, renamed the same way
 * in the same round for consistency across all three portals.
 *
 * Round twelve: rebuilt around `SettingsGroup`/`SettingsRow`
 * (`components/design-system/settings-list.tsx`), see
 * `app/driver/settings/page.tsx`'s own comment for the full reasoning,
 * the same change landed on all three portal settings pages together.
 * This page was the model the other two were built from in round ten,
 * so it stays that way here too: same shape, same components, on all
 * three.
 *
 * Module 44: "Payout details" and "Documents" moved in here from their
 * own top-level sidebar items, the same way "Password" already lived
 * inside Settings rather than getting its own nav entry (see the
 * `SettingsRow` for it just below). Direct feedback: "in the web the
 * payout details is should be inside the settings, documents should also
 * be inside the settings, change password should also be inside the
 * settings, so when a user click on the profile or investor's name it
 * should open the settings." The last part, the sidebar avatar/name
 * linking to this page, was already true since round twelve
 * (`profileHref="/investor/settings"` in `app/investor/layout.tsx`,
 * passed through to `AppShell`), this module is the two new rows plus
 * removing their old standalone sidebar items so they're reached through
 * here instead. Both still live at their own real routes
 * (`/investor/payout-details`, `/investor/documents`, unchanged, still
 * linked from elsewhere in the app, like `/investor/wallet`'s "Add bank
 * details" link and `/kyc`'s "Payout details" link), a `SettingsRow`
 * with `href` is a navigate-away chevron row, not an inline embed, the
 * same shape "Password" already used to reach `/change-password`.
 * Rebuilding either as full inline forms directly on this page (a bank
 * account resolved against Paystack, a document upload with its own
 * file input and status badges) would only duplicate real, already-
 * working pages for no benefit.
 *
 * Module 44 follow-up: direct feedback, "i have seen the cards but is
 * just by the left hand side only, it doesnt look good, make it look
 * good." The three `SettingsGroup`s were a single fixed `max-w-[560px]`
 * column pinned to the left edge, on any screen wider than that it left
 * a large dead gap on the right rather than using the space, which
 * became a lot more noticeable once this page grew a third group. Fixed
 * the same way `/admin/settings/contract-terms` already handles more
 * content than fits one column, a responsive `lg:grid-cols-2`: below
 * `lg` everything still stacks in one column exactly as before (no
 * regression on the mobile-width breakpoint this app already treats as
 * its own layout), at `lg` and up "Personal data" sits in the left
 * column and "Payments" plus "Security" stack in the right, each column
 * landing close to the original 560px card width so no single row gets
 * any harder to read, the difference is the page now actually uses the
 * width it has instead of stranding it as empty space.
 */
export default async function InvestorSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Settings</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Your name, phone number, payout details, documents, password, and two-factor authentication, all in one
          place.
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
          <SettingsSectionLabel>Payments</SettingsSectionLabel>
          <SettingsGroup>
            <SettingsRow
              icon={<BankFieldIcon />}
              primary="Payout details"
              secondary="Bank account and payout destination"
              href="/investor/payout-details"
            />
            <SettingsRow
              icon={<DocumentFieldIcon />}
              primary="Documents"
              secondary="Identity documents and files shared with you"
              href="/investor/documents"
            />
          </SettingsGroup>

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
