/**
 * Round twelve: direct feedback on keke-mobile's new grouped Profile
 * tab ("focus on the gtbank app... i like there icons," see
 * `keke-mobile/src/app/(app)/profile.tsx`'s own comment for the full
 * quote and the frame-by-frame review of GTBank's app it came from) was
 * "you should do something similar to the web app... group them
 * accordingly." These five are the web counterpart to the four new
 * mobile icons (`keke-mobile/src/components/icons.tsx`'s PhoneIcon,
 * LockIcon, ShieldIcon, ThemeIcon), same shapes translated to plain
 * `<svg>`/`<path>` in place of `<Svg>`/`<Path>`, 24x24 viewBox, ~1.7-1.8
 * stroke width, matching the icon language every sidebar in this app
 * already uses (see app/admin/layout.tsx and friends). `ProfileFieldIcon`
 * is new on the web side too, mirroring keke-mobile's ProfileIcon used
 * the same way, for a settings row showing someone's own name.
 */
export function ProfileFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8.3" r="3.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PhoneFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.6 3.5h2.2l1.4 4-1.9 1.4a11.5 11.5 0 0 0 5.3 5.3l1.4-1.9 4 1.4v2.2c0 1-.9 1.8-1.9 1.7-8-.7-14-6.7-14.7-14.7C2.3 4.4 3.1 3.5 4.1 3.5H6.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MailFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LockFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.8" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function ShieldFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.3 5.5 5.8v5.1c0 4.7 2.9 8.3 6.5 9.3 3.6-1 6.5-4.6 6.5-9.3V5.8L12 3.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 12.1l2 2.1 4-4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Module 44: two more field icons for the investor Settings page, "Payout
 * details" and "Documents" moving in from their own top-level sidebar
 * items to sit inside Settings the same way "Password" already did (see
 * this file's own round twelve comment above). Same shapes the sidebar
 * nav already used for these two items (`app/investor/layout.tsx`), just
 * resized to this file's 18x18/1.6-1.7-stroke convention rather than new
 * ones invented from scratch.
 */
export function BankFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentFieldIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
