import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Round twelve: direct feedback, "you should do something similar to
 * the web app, make it as beutiful as the mobile too, group them
 * accordinly when one click on profile like that," after keke-mobile's
 * Profile tab was rebuilt around GTBank's own grouped-list layout (see
 * `keke-mobile/src/components/settings-list.tsx`'s own comment for the
 * full review of that app). `SettingsSectionLabel` is the small caps
 * label above a group ("Personal data," "Security"), `SettingsGroup` is
 * the rounded card holding related rows, and `SettingsRow` is one row:
 * an icon, a bold primary line, an optional muted second line, and
 * either a chevron (`href`, navigates) or a custom `trailing` node (a
 * `ToggleSwitch`, `components/ui/toggle-switch.tsx`).
 *
 * `SettingsGroup` uses Tailwind's `divide-y` rather than keke-mobile's
 * manual `divider` prop on every row: React Native has no CSS sibling
 * selector to lean on, the web does, so a row here never has to know
 * whether it's first. That also means a row doesn't have to be a
 * `SettingsRow` specifically, any direct child works, which is what
 * lets `MfaSettings` (`components/account/mfa-settings.tsx`) and
 * `PhoneNumberRow` (`components/account/phone-settings-form.tsx`) sit
 * in the same group as a plain `SettingsRow`: both render one row plus
 * an optional expanded panel below it, as a single child element, so
 * `divide-y` still only draws one line above them, not one above the
 * row and another above the panel.
 */
export function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wide text-text-faint">{children}</div>;
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      {children}
    </div>
  );
}

export function SettingsRow({
  icon,
  primary,
  secondary,
  href,
  trailing,
}: {
  icon: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  href?: string;
  trailing?: ReactNode;
}) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center text-accent">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{primary}</div>
        {secondary ? <div className="mt-0.5 truncate text-[11.5px] text-text-faint">{secondary}</div> : null}
      </div>
      {trailing !== undefined ? trailing : href ? <SettingsRowChevron /> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-colors hover:bg-background">
        {content}
      </Link>
    );
  }

  return content;
}

function SettingsRowChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-text-faint">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
