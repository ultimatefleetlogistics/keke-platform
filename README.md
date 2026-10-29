# Ultimate: Keke Investment, Fleet & Investor Management Platform

A Next.js application for managing vehicle investments (keke, car, or
bike): investor contracts, fleet, agents and drivers, and
Paystack-driven remittances and payouts. See `docs/architecture` for the
full design, and `docs/architecture/CURRENT_STATE.md` specifically for an
up to date snapshot of what's built and what isn't, useful for getting
oriented from scratch without reading this entire changelog.

## What is here right now (Module 60: the client's real logo, implemented everywhere branding appears, web and mobile)

The client's brand sheet PDF (horizontal/stacked lockups, icon-only mark, a circular badge, full-color and reversed) replaced `KekeIcon`, a generic tricycle placeholder, everywhere it was standing in as a brand mark. This is a logo swap, not a rebrand — the rest of the app's gold/charcoal design system is untouched. Treatment, agreed with the project owner: one consistent full-color version everywhere (not a reversed white version on dark surfaces and color elsewhere), cropped per container, on a small white plate wherever the surrounding surface is dark.

- **Web, 6 files.** `components/layout/app-shell.tsx` (desktop sidebar + mobile top bar) now renders the full-color horizontal lockup directly; `app/sign-in`, `app/sign-up`, `app/forgot-password`, and `app/admin-sign-in` swap the icon inside their existing badge box; `app/opengraph-image.tsx` (the social-share preview) swaps the gold box + bell placeholder for the real icon on white. New assets: `public/brand/icon.png`, `public/brand/logo-horizontal.png`, `app/favicon.ico` (square-padded first, so the multi-size ICO doesn't come out non-square).
- **Mobile, 2 screens + icon config.** `src/app/welcome.tsx` and `src/app/sign-in.tsx` swap `KekeIcon` for the real icon inside their existing white badge (the genuinely-used `KekeIcon` elsewhere, e.g. the Fleet tab icon, was left alone). `app.json`'s `android.adaptiveIcon.backgroundColor` went from `#1F1A12` to `#FFFFFF` to back the transparent foreground icon. New/replaced assets under `assets/images/`: `icon.png`/`favicon.png`/`splash-icon.png` (opaque white, app icons need it), `android-icon-foreground.png`/`android-icon-background.png`/`android-icon-monochrome.png`, `brand-icon.png` (small in-app badge use).
- **A derived asset was abandoned rather than shipped broken.** A reversed white-on-blue variant was chroma-keyed for dark-surface use, but the mark's flame element is pixel-connected to its own background (confirmed via `scipy.ndimage.label`), so any global color-key erased part of the flame. Every placement uses the genuine, unmodified full-color source on a light plate instead.
- Every changed file syntax-checked with `esbuild`; every committed file (code and images) re-staged from the device afterward and checked byte-for-byte or pixel-for-pixel against what was sent. Not verified against a real running app or a real click-through in either repo. See `docs/architecture/CURRENT_STATE.md` ("The client's real logo, implemented everywhere branding appears, Module 60") for the full file-by-file writeup, including a factual correction about the reversed logo's colors made earlier in conversation.

## Previously delivered (Module 59: the five staff-facing admin tools the sold proposal promised in place of agent/driver self-service, built for real)

`missing-features-agent-driver-restructure.md` in this project's Claude Desktop docs lists five staff-facing Admin Console features, written into the sold ₦22,000,000 proposal as the explicit replacement for the agent/driver self-service portals Module 58 (below) confirmed the client doesn't want turned on. That doc's own "BUILT" label meant "written into the proposal document," not "exists in code" — none of the five actually existed in this codebase before this module. Surfaced to the project owner rather than assumed; the instruction back was to build all five now.

- **1. Agent/driver management proxy screens.** `/admin/drivers/[id]` was a bare edit form before this module; it's now a full proxy view mirroring `/admin/agents/[id]`'s existing shape — totals, edit form, account access, collection account, identity verification, a cash-deposit form, and a deposit history table with reversal buttons. Both list pages got a new "Standing" column.
- **2. Manual/cash remittance capture.** `recordManualPayment` (`lib/actions/manual-payments.ts`) records a cash handoff exactly like an electronic Paystack webhook would — same `PaymentTransaction` shape, same schedule-entry allocation logic — with a required reason and the recording staff member's id attached, and fires the same SMS/email alert an electronic remittance already triggers.
- **3. Proactive delinquency alerts.** One live definition of "late" (`lib/delinquency.ts`, 7 days since last payment, no cron anywhere in this app so it's computed on read everywhere it's shown), now surfacing in three places: the agent/driver list pages' Standing column, the agent/driver detail pages' header badge, and the operations dashboard's existing "Needs attention" card.
- **4. Staff-driven KYC/onboarding entry.** Since agents/drivers never sign in to upload anything themselves, staff enter a government ID or proof of address on their behalf (`lib/actions/agent-driver-kyc.ts`) and a (possibly different) staff member with review permission verifies or rejects it, right on the subject's own detail page — same maker-checker shape `/kyc`'s investor flow already has.
- **5. Dispute/adjustment tool with audit trail.** `reversePaymentTransaction` unwinds a recorded payment's schedule allocations and running totals, with a required reason and a full before/after audit log entry, collapsed to a small "Reverse" link on each history row so it doesn't sit as a permanently visible destructive action.
- **No new RBAC permissions.** Every new mutating action reuses an existing `PERMISSIONS` key whose semantics already covered it (`RECONCILIATION_VIEW`, `STAFF_MANAGE`/`FLEET_MANAGE`, `KYC_REVIEW`), the same precedent `matchProviderTransaction`/`dismissProviderTransaction` already set, rather than adding a key that would need a database reseed to become assignable.
- **One migration owed, not yet deployed**: `prisma/migrations/20260929120000_add_agent_driver_kyc_and_manual_payments` adds `agents.kycStatus`/`drivers.kycStatus`, a new `agent_driver_documents` table, and `payment_transactions.note`/`recordedById`, hand-written for the same reason every migration since Module 49 has been (this sandbox can't reach `binaries.prisma.sh`). Run `npx prisma migrate deploy` then `npx prisma generate` from the project owner's own machine before any of this module's code paths work against the real database.
- Every touched/new file syntax-checked with `esbuild`, each edit read back against the real committed file, not verified against a real running app or click-through. See `docs/architecture/CURRENT_STATE.md` ("Staff-facing agent/driver admin tools, Module 59") for the full file-by-file writeup.

## Previously delivered (Module 58: a reversible on/off switch for agent/driver platform access, kept off the sold scope but not ripped out)

`client-decisions-log.md` decision #1 has the client confirming, back at proposal time, that agents and drivers get no self-service login at all, web or mobile, remittances handled entirely by staff. A routine session found that decision was never actually carried into this codebase: both `/agent/*`/`/driver/*` here and `keke-mobile`'s agent/driver dashboards are fully built, and Module 56/57 (`keke-mobile/README.md`) had just added offline caching to every one of those screens. Surfaced directly to the project owner rather than quietly built around or quietly deleted.

- **Resolution, not a rebuild**: the decision stands (no self-service access right now), but the project owner explicitly asked to keep the built portals rather than delete them, so that switching access back on later, if the client changes their mind, is a config flip, not two portals rebuilt from scratch across two repos.
- **One flag, `AGENT_DRIVER_PORTAL_ENABLED`** (new `lib/config/portal-access.ts`), checked everywhere an agent/driver account currently gets into a portal: `resolvePortalDestination` (web sign-in redirect, `lib/actions/auth.ts`), `GET /api/v1/me` (mobile's own gate, `app/api/v1/me/route.ts`), `app/agent/layout.tsx`/`app/driver/layout.tsx` (defense-in-depth for an already-open session or a direct URL), and `keke-mobile/src/context/auth-context.tsx` (force sign-out with a clear message, mirroring the existing staff block exactly). None of the underlying screens changed.
- **Defaults to today's real behavior, on purpose, per the project owner's own instruction**: unset (every deployment right now) reads as enabled, agent/driver sign-in works exactly as it always has. Nothing changes for anyone until someone deliberately sets `AGENT_DRIVER_PORTAL_ENABLED=false` and redeploys; unsetting it again turns access straight back on, same deal in reverse. `.env.example` documents it.
- Not verified against a real running app, `esbuild` syntax checks only, same limitation as every other change this round. See `docs/architecture/CURRENT_STATE.md` ("Agent/driver portal access flag, Module 58") for the full writeup.

## Previously delivered (Module 55: a Content-Security-Policy robustness pass — a stronger nonce, and violations now report to Sentry)

Direct ask, after Module 45's own disclosure that the CSP header it added had never been checked against a real browser: check it properly and harden it, rather than leaving "watch the browser console" as the only way anyone would find out it broke something.

- **Every directive re-verified against what this app actually loads, not re-derived from scratch.** `script-src`/`style-src` nonce wiring, `connect-src`'s Supabase-project and Sentry scoping, `frame-ancestors 'none'`, and the rest were all checked again and confirmed correct. `img-src 'self' blob: data:` specifically re-checked with a fresh grep for remote image usage: `next.config.ts` sets no `images.remotePatterns`, the app's one `next/image` usage only renders local bundled assets, and the one Supabase Storage read in the app (a KYC document's signed URL) opens as a link in a new tab, not a same-page image load. Nothing needed widening.
- **The nonce is now built from real random bytes, not a re-encoded UUID.** It was `Buffer.from(crypto.randomUUID()).toString("base64")`, base64-encoding a UUID's 36-character hyphenated text form, which worked (still 122 random bits, unique and unguessable per request) but wasn't the textbook construction. Now `Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64")`, 128 raw random bits straight from the Web Crypto CSPRNG. Deliberately not Node's `crypto.randomBytes`, which doesn't exist on the Edge Runtime `proxy.ts` runs on, `crypto.getRandomValues` is the same Web Crypto interface `crypto.randomUUID()` was already implicitly using.
- **CSP violations now report to Sentry instead of only showing up in a browser console someone happens to have open.** New `app/api/csp-report/route.ts`, an unauthenticated Route Handler (a browser sends these on its own, no session to check, the same shape as the Paystack webhook route next to it) that parses either report format a browser sends and forwards it to Sentry via `Sentry.captureMessage`, fingerprinted on the violated directive and blocked URI so repeated identical violations collapse into one Sentry issue instead of one alert each, the same grouping every other `Sentry.capture*` call in this app already relies on. `proxy.ts`'s CSP header now sends `report-uri`/`report-to`, paired with a new `Reporting-Endpoints` response header that tells the browser where `report-to` actually points.
- Not verified against a real running browser, the same limitation every change to this file has carried since Module 45. Both files syntax-checked. See `docs/architecture/CURRENT_STATE.md` ("Content-Security-Policy robustness pass, Module 55") for the full writeup.

## Previously delivered (Module 54: BVN/NIN stepped down on the client's explicit request)

Direct instruction: BVN/NIN are not going to be used, so step it down. Module 46 (below) had added an automated Dojah check on top of the BVN/NIN fields `/kyc` already collected; this module brings the actual code back in line with `client-decisions-log.md` decision #2, which the project owner reconfirmed directly this round: identity verification stays document-only, a government ID and a proof of address, reviewed by staff, nothing else.

- **Every real reference found by grep, not assumed**: BVN/NIN/Dojah turned up in 12 code files plus this README and `CURRENT_STATE.md`. The investor-facing `/kyc` page lost its entire BVN/NIN form, both status badges, and the "Save BVN & NIN" button; both admin KYC screens (the queue list and the per-investor review page) lost their BVN/NIN columns and cards. The retired save action and its Dojah bridge are marked RETIRED in their own header comments and left on disk unreferenced, this project's device bridge still can't delete files, same as `components/app-lock-overlay.tsx` in Module 52 below.
- **One real behavioral gap had to be closed, not just UI removed**: uploading a KYC document never used to move an investor's overall `kycStatus` to `PENDING_REVIEW` by itself, that was always the BVN/NIN save action's job. `uploadKycDocument` now does it directly, otherwise nothing would ever put a fresh investor into the review queue's status-driven state again.
- `.env.example`'s Dojah section is marked stepped down, its three variables commented out rather than deleted. `prisma/schema.prisma`'s `bvn`/`nin`/`VerificationStatus` columns were deliberately left in place, dropping them needs a real migration this sandbox still can't generate, not urgent enough to justify one on its own.
- Every touched file syntax-checked, each edit read back against the real file before being committed. See `docs/architecture/CURRENT_STATE.md` ("BVN/NIN stepped down on the client's explicit request, Module 54") for the full file-by-file writeup.

## Previously delivered (Module 53: branded SMS and email templates for transaction alerts)

Direct ask to see what the SMS/email alerts actually looked like before approving anything, followed by two reference screenshots (a structured bank SMS, a Wise/Payoneer-style receipt email) and a request to adapt that shape to Ultimate's own branding. Two mockups were published for review before any code changed; the redesign was approved with four explicit decisions: HTML email (not a PDF attachment), the field-by-field bank-style SMS, `"ULTIMATE"` as sender name stays a placeholder, `support@ultimate.africa` stays a placeholder support address.

- **New `lib/notifications/templates.ts`** is the single source both channels render from: `buildAlertSms` (kind, amount, balance when there is one, description or decline reason, date, no sender name repeated in the body since Termii's own Sender ID already shows that) and `buildAlertEmailHtml` (a table-based, all-inline-styles HTML receipt, deliberately not the modern CSS the mockup used, since this renders in real inboxes via Resend, not a browser). `smsSafeDesc()` truncates free text to 60 characters so a long decline reason can't silently double a message's SMS segment cost; `escapeHtml()` covers every field that can carry staff-typed free text before it reaches the email HTML.
- **Wired into all five existing transaction-alert call sites** with real, correct data: remittance and investor-deposit alerts in `lib/payments/webhook-handler.ts`, bank-payout and wallet-payout alerts in `lib/payments/batch-processor.ts`, and withdrawal-approved/withdrawal-declined/vehicle-funded-from-wallet alerts in `lib/actions/wallet.ts`.
- **One real wording bug caught along the way**: the declined-withdrawal alert now says "Still in your wallet," not "returned," since a request that's still `PENDING_APPROVAL` when staff reject it was never actually debited, there's nothing to return.
- Not verified against a real Resend/Termii send, no live credentials or network egress from this sandbox. `RESEND_FROM_EMAIL` and `TERMII_API_KEY`/`TERMII_SENDER_ID` still need real values in production before either channel actually delivers, unchanged by this module. See `docs/architecture/CURRENT_STATE.md` ("Transaction alert redesign, Module 53") for the full writeup.

## Previously delivered (Module 52: keke-mobile App Lock redesign — no more auto-firing biometric dialog with no escape)

Direct report from the project owner's own device: on a fresh relaunch the app skipped the sign-in screen entirely and showed a full-screen fingerprint prompt firing on its own, loading behind it, with no way to back out if the wrong finger was used. Separately, "Sign out" was landing back on the sign-in screen rather than the Get Started/welcome screen.

- **Root cause**: the old "soft sign-out" architecture kept the real session token alive while a local `locked` flag hid the app behind a full-screen overlay that auto-fired the native biometric prompt. `AppLockProvider`'s hardware-detection is async, and on a cold relaunch the overlay could mount and fire the native dialog before that check resolved, so the dialog visually covered its own fallback button underneath it.
- **Fixed by retiring the auto-firing overlay, not just adding a more visible escape button.** New `initializing` state on `AppLockContext` makes the route guards (`app/index.tsx`, `app/(app)/_layout.tsx`) wait for the async check to resolve before deciding, then redirect to `/sign-in` when locked, the same screen a fresh sign-in uses, which needs an explicit tap before any native prompt fires and always shows a password fallback alongside it. `locked` is now a pure UI gate, the real session is never touched just to lock the screen. `components/app-lock-overlay.tsx` is marked retired and left unreferenced.
- **Sign out fixed the same session**: `signOut()` now always does a full, real sign-out to `/welcome`, no soft-lock branch.
- Confirmed working directly by the project owner on their own device. Not verified in this sandbox, which has no phone or simulator attached to `keke-mobile`. See `docs/architecture/CURRENT_STATE.md` ("App Lock redesign, Module 52") for the full writeup.

## Previously delivered (Module 51: a real Admin sign-in blocked from ownership transfers, root-caused and fixed for good)

Direct report from the project owner's own machine: signed in as Admin,
clicked into Ownership transfers, got "Your role doesn't include
permission to view ownership transfers." A real Admin account should never
see that, so this was investigated rather than waved off as a one-off
seed gap.

**Root cause: "system role always holds every permission" was only ever
true at seed time, not enforced at the moment it mattered.** The Admin
role is marked `isSystem: true` in the database, and both the code
comments and the roles settings screen itself say plainly that a system
role "always holds every permission and can't be edited." But the actual
authorization check (`getUserPermissions` in
`lib/rbac/check-permission.ts`) never enforced that, it read the same
RolePermission junction rows any ordinary role reads. Those rows only
ever get created by `npx prisma db seed`, so the instant a new permission
key is added to the `PERMISSIONS` catalog, it is missing from every
existing database's Admin role until someone remembers to reseed, even
though the settings screen keeps confidently showing every permission as
"Granted" regardless. That's exactly what happened here:
`transfer.verify`/`transfer.approve` are real, seeded permissions, but the
project owner's own database had never linked them to their Admin role,
almost certainly seeded before ownership transfers existed and never
reseeded since.

**Fixed at the root, not just for this one database.**
`getUserPermissions` now checks whether any of a user's role assignments
is a system role, and if so returns the full permission catalog directly
rather than trusting junction rows that can drift out of sync with it.
This is the same shared function both the web app and the mobile API's
auth layer already call, so one fix covers both. The roles list screen's
permission count for a system role was also switched from the (now
allowed to be stale) junction-row count to the real catalog size, so it
doesn't contradict the "always holds every permission" claim right next
to it. Running `npx prisma db seed` again is still worth doing to bring
the database's own records back in sync, but the app no longer depends on
that step for a system Admin's access to actually be correct.

## Previously delivered (Module 50: the owed migration deploy confirmed, plus a second migration file recovered along the way)

Direct follow-up from the project owner's own machine, on the very step
Module 49 below said was still owed.

**1. `npx prisma migrate deploy` ran and succeeded.** Reported "7
migrations found in prisma/migrations," applied
`20260907140000_add_bvn_nin_verification`, confirmed "All migrations
have been successfully applied." The `PrismaClientKnownRequestError`
(`P2022`, missing `bvnVerificationStatus` column) that was breaking
every signed-in page in Module 49 should be gone now.

**2. That "7" surfaced a second real gap, found and fixed on the
spot.** Expected 5 migrations after Module 46 (4 confirmed back in
Module 31, plus Module 46's own), got 7. This sandbox's own copy of
`prisma/migrations/` only had 6 folders, one short. Checking the
project owner's real folder found the extra one:
`20260901140414_add_password_and_payout_preference` (the
`defaultPayoutDestination`/`mustChangePassword` columns), already
applied on the real database and already used by this sandbox's own
schema and code, just never present in this sandbox's copy of the
repo's migration history, most likely lost somewhere between whichever
earlier module first delivered it and this sandbox's own longer-running
working copy (this project's git history can't confirm or rule that
out, it has one commit total). Read back from the project owner's
machine and restored into this sandbox so the two copies match.
Practical note going forward: this sandbox's `prisma/migrations/`
folder is a working draft, not guaranteed to be the complete history,
the same caution already applied to its Prisma Client and its
`eslint`/`tsc`/`vitest` output.

See `docs/architecture/CURRENT_STATE.md`'s "Migration deploy confirmed,
and a missing migration file recovered (Module 50)" section for the
full writeup.

## Previously delivered (Module 49: the Module 48 fix confirmed, a real migration that was never applied, and a researched-but-not-shipped console warning)

Direct feedback, three separate things reported from the project owner's
own machine in one round:

**1. Confirmed: `npm run build` is now fully clean, for the first time
with this exact codebase.** All 78 routes compiled, typechecked, and
generated with zero errors, closing the loop Module 48 opened (its own
fix was shipped without a second local build to confirm it, this is
that confirmation, run independently on the project owner's machine
rather than assumed).

**2. A real runtime error, not a code bug: `npm run dev` failed on
every signed-in page** with `PrismaClientKnownRequestError` (`P2022`),
`The column investor_profiles.bvnVerificationStatus does not exist in
the current database`. This is not a schema bug, it's a step that was
never run: Module 46 added that column (and five others) to
`prisma/schema.prisma` and wrote the matching migration
(`prisma/migrations/20260907140000_add_bvn_nin_verification`), but a
file being delivered into the project folder does not apply it to the
project owner's actual Supabase database, that needs an explicit
command run once, on a machine that can reach it (this sandbox
never could). **Fix: run `npx prisma migrate deploy` from the
`keke-platform` folder.** That applies every migration in
`prisma/migrations/` the database doesn't already have recorded as
applied, in order, without touching any of the four migrations already
confirmed applied back in Module 31 and this codebase's `_prisma_migrations`
history, and without the reset-prompting behavior `prisma migrate dev`
can trigger against a database that already holds real investor data.
No code changed for this one, it's purely an operational step still
owed on the project owner's side.

**3. Researched, deliberately not fixed: a cosmetic console warning.**
"Encountered a script tag while rendering React component," pointing
at the theme-init script in `app/layout.tsx`. Confirmed via web
research to be a known, currently-unresolved React 19 + Next.js 16.2+
false positive that also hits `next-themes` (the most widely used React
theming library, doing the identical pattern), not something specific
to this app's own code, and Next's own docs already confirm this
script's placement was never the cause (`beforeInteractive` scripts
"will always be injected inside the head... regardless of where it's
placed"). A real fix exists in theory
(`useServerInsertedHTML`), but was deliberately not shipped after
finding an open, unresolved Next.js GitHub discussion reporting that
hook's content landing somewhere other than `<head>` inconsistently
for other users, exactly the wrong kind of uncertainty to accept for a
script whose entire job is running before paint, on every request,
with no real browser in this sandbox to verify the change against
first. See `app/layout.tsx`'s own updated comment for the full
reasoning and sources. The warning is confirmed cosmetic, the script
still runs correctly and dark mode still works with no flash, nothing
about the app's actual behavior is affected.

## Previously delivered (Module 48: a real `next build` finally ran clean on the project owner's own machine)

Direct feedback: `npx prisma generate` succeeded for real on the
project owner's own Windows machine (confirming, again, that this
sandbox's block on reaching `binaries.prisma.sh` is a sandbox-only
limit, not a real one), then `npm run build` (the correct command,
`next build` alone fails in PowerShell since `next` is a project
dependency, not a global command, that part wasn't a bug) got further
than it ever has and hit one real TypeScript error:

```
lib/data/investor.ts(99,19): error TS18047: 'c.vehicle.currentDriver.user' is possibly 'null'.
```

**Real bug, not sandbox noise.** `getInvestorDashboardData` reads
`c.vehicle.currentDriver?.user.fullName`, one `?.` short. `Driver.user`
is genuinely optional in the schema (`user User? @relation(...)`, "a
driver may or may not have direct app access"), the only nullable
`user` relation among Investor/Agent/Staff/Driver, all four of which
otherwise get a plain, required `User` row. The existing `?.` covers
`currentDriver` possibly being absent, but `.user` right after it can
independently be null even when a driver is assigned, if that driver
has no linked app account. `npx tsc --noEmit` and `next dev` both let
this through without complaint, a real production type check with
`next build` (which this sandbox cannot itself run to completion, see
Known gaps) is what finally caught it. Fixed with the missing `?.`:
`currentDriver?.user?.fullName ?? null`. Grepped every other
`.user.fullName`/`.user.email`/`.user.phone` access in the codebase
(dozens) to check for the same mistake elsewhere: this was the only
one, every other access reads `.user` off Investor/Agent/Staff, all
non-nullable, or is on `driver.user` already correctly guarded with an
explicit `if (driver.user)` check (`lib/actions/drivers.ts`). This
function backs both the web investor dashboard and, unchanged since
Module 37, the mobile `GET /api/v1/investor/summary` endpoint, so the
one fix covers both.

Verified: `npx eslint .` clean, `npx tsc --noEmit` shows the same
pre-existing stale-Prisma-Client noise as always, nothing new, `npx
vitest run` stayed at 98/98 (this bug shape, a real production
type-checker catching a case unit tests don't construct, is exactly
why "Module 31, a full pass" under Known gaps already flags occasional
real `next build` runs as worth doing, not just `npm run lint`). Not
re-verified with a second `next build` from inside this sandbox, it
still can't run one to completion here, the project owner's own next
run of `npm run build` is what actually confirms this specific fix.

## Previously delivered (Module 47: fixed a real crash on Wallet, and everywhere else the same pattern was used)

Direct feedback: clicking into Wallet crashed with "Functions are not
valid as a child of Client Components," a real bug hit for the first
time in an actual browser, this sandbox has never had one attached to
this app to catch it itself.

**Root cause.** `ActionForm` (`components/ui/action-form.tsx`, Module
43) originally let a caller pass its submit button as a render-prop,
`children={({ isSubmitting }) => (...)}`, so the caller could read
`isSubmitting` and show a loading spinner. That is invalid in the
Next.js App Router the moment the caller is a Server Component, which
almost every call site is: a Server Component is only allowed to pass
plain, already-resolved JSX as a Client Component's children, never a
function, functions cannot cross that boundary at all. It happened to
work in Client Component form files (three of them,
`app/kyc/identity-form.tsx` and two others) because both sides of that
boundary were Client Components there, nothing actually crossed a
server/client edge. Grepped the whole codebase for the same shape and
found it in 20 files, not just Wallet: KYC review, fleet, drivers,
transfers, payment batches, roles, staff, investors, contract terms,
payout details, and the shared document upload/delete card used on
both the contract and fleet detail pages.

**Fix.** `ActionForm` now exposes `isSubmitting`/`error` through a
React Context instead of a render-prop, and a new
`ActionSubmitButton` (same file) reads that context and renders the
actual `<Button type="submit" loading={...}>`. Every call site went
back to writing plain JSX, `<ActionSubmitButton>Approve</ActionSubmitButton>`
instead of `{({ isSubmitting }) => <Button loading={isSubmitting}>Approve</Button>}`,
which a Server Component is allowed to pass down. Converted all 20
files, including the three Client Component ones, so the whole
codebase shares one pattern and this bug shape can't come back through
a copy-pasted render-prop.

**Verified**: `npx eslint .` clean across the whole project, `npx
tsc --noEmit` shows zero new errors (cross-checked file by file
against every file this module touched, the ~275 lines it still
prints are the same pre-existing implicit-any/stale-Prisma-Client
noise `docs/architecture/CURRENT_STATE.md`'s Known gaps already
tracks), `npx vitest run` still 98/98 (this bug shape isn't something
a component test would have caught either, it only shows up when
React actually tries to render the tree in a browser). **Still not
verified against a real running browser**, this sandbox has never had
one attached to this app, the same limitation Module 45's hardening
pass already flagged; this fix is a structural one (the exact
React/Next rule that was being violated, not a guess), and every
affected page now compiles and passes the same checks the app already
holds itself to, but a real click-through in the project owner's own
browser is worth doing before considering this fully closed.

## Previously delivered (Module 46: automated BVN/NIN verification against Dojah)

Direct feedback, working through the three items explicitly deferred at
the end of Module 45: the CAR/BIKE contract term numbers stayed exactly
as they were, entering them as a settings change whenever the business
has real figures rather than hardcoding placeholders was confirmed as
the right shape, nothing to build there. This module is the second of
the three, BVN and NIN. App/Play Store deployment is still untouched,
next in line.

Before writing any code: researched which vendor to use, since Paystack
(already integrated, see "Payments" below) cannot check a NIN at all,
and its BVN check is asynchronous and tied to a specific bank account
rather than a standalone lookup. Compared Dojah, Youverify, and
VerifyMe Nigeria/QoreID on what's actually publicly documented.
**Picked Dojah**: the only one of the three with concretely documented,
synchronous endpoints for both BVN (`GET /kyc/bvn/full`) and NIN
(`GET /kyc/nin`), a free sandbox, and transparent starting pricing
($0.04 to $0.06 per call). Real caveats disclosed at the time and still
true: no independent user reviews found yet (a young company, an
unclaimed review-site listing), and none of the three vendors checked
publicly claim official NIMC/NIBSS partner status, worth confirming
directly before this goes live with real credentials, not something
settled by this research alone.

- **New `lib/verification/dojah-client.ts`**, the same "one file owns
  every real call to this vendor" pattern `lib/payments/paystack-client.ts`
  already uses for Paystack: `lookupBvn`/`lookupNin` (GET requests,
  `AppId` and `Authorization` headers, the latter with no `Bearer`
  prefix, Dojah's own documented shape, different from Paystack's),
  `isDojahConfigured()` (true only once both `DOJAH_APP_ID` and
  `DOJAH_API_KEY` are set), and `namesReasonablyMatch()`, a deliberately
  lenient name-matching rule (first and last name must both appear
  somewhere in the investor's own stated full name, either order,
  middle name ignored) rather than an exact-string check, since a real
  person's typed name routinely drops or reorders a middle name and a
  stricter check would flag entirely legitimate investors as
  mismatches. New `lib/verification/identity-check.ts` wraps both
  lookups into exactly the four-value result
  (`VERIFIED`/`NAME_MISMATCH`/`NOT_FOUND`/`FAILED`) the schema now
  stores, and returns `null` (not `FAILED`) when Dojah isn't
  configured at all, a distinct "this feature is off" state from "we
  tried and it failed."
- **`InvestorProfile` gets six new columns**, three per identifier
  (verification status, the name Dojah returned, and when the check
  ran), migration
  `prisma/migrations/20260907140000_add_bvn_nin_verification`. The
  existing `bvn`/`nin` text columns are untouched, still exactly what
  the investor typed, unrelated to whether it was ever checked.
- **`/kyc`'s existing BVN/NIN form now actually checks what you typed.**
  `submitIdentityDetails` (`app/kyc/actions.ts`) calls Dojah the moment
  a BVN or NIN actually changes from what was already saved (not on
  every re-submission, re-typing the other field doesn't spend another
  call on a number nothing new is known about), and the form shows a
  badge next to each field once there's a result: green "Verified,"
  red "Name doesn't match" or "Not found," amber "Could not check."
  Staff sees the same signal, plus the name Dojah has on file, on
  `/admin/kyc/[investorId]`.
- **This is a signal, not a gate, on purpose.** Nothing here blocks
  saving, and `kycStatus` still only ever moves to `PENDING_REVIEW`
  from this form, never straight to `VERIFIED`, the exact same rule
  that already existed before this module. An automated name mismatch
  is a strong, real reason for staff to look closer at a submission,
  not grounds to auto-reject an investor over what could just as
  easily be a Dojah data-quality issue.
- **Fully backward compatible with `DOJAH_API_KEY`/`DOJAH_APP_ID`
  unset**, the state every deployment starts in until the project
  owner actually signs up with Dojah and confirms it. Unset, this
  behaves exactly as it did before this module: BVN/NIN save as plain
  text, `kycStatus` still moves to `PENDING_REVIEW`, no verification
  fields ever get touched, no Dojah call is ever attempted. `.env.example`
  documents both variables plus `DOJAH_ENVIRONMENT` (defaults to
  Dojah's sandbox, matching the safe-by-default posture
  `PAYSTACK_DVA_PREFERRED_BANK=test-bank` already uses, set to `live`
  only once deliberately ready for real, billable, real-identity
  checks).
- Verified with `npx vitest run` (18 new tests for the Dojah client and
  the name-matching rule, 98/98 across the whole suite), `npx eslint .`,
  and `npx tsc --noEmit` filtered against every touched file (clean).
  **Not** verified against a live Dojah account, this sandbox has
  neither real credentials nor, per Module 45's own findings, reliable
  outbound network access to test one even with real credentials. The
  request shape, header names, and response field names come straight
  from Dojah's own current published API reference, not guessed, but
  a real sandbox-key smoke test on the project owner's own machine is
  worth doing before this goes anywhere near a live BVN or NIN.
- **Superseded, Module 54, well above**: BVN/NIN verification was stepped
  down entirely on the client's explicit request, this whole feature is
  no longer live, see Module 54's own entry for what changed and why.
  Left here as the historical record of the vendor research.

## Previously delivered (Module 45: npm audit fixes, encrypted mobile sessions, a real Content-Security-Policy, and a self-hosted font)

Direct feedback: "okay fix everything but we will talk about deploying
the mobile to app/play store, the bvn/nin and the car and bike contract
terms too leave it for now," following straight on from a "so what is
remaining?" status check. This is that "everything": app-store
deployment, BVN/NIN verification, and the CAR/BIKE contract term
placeholders were explicitly left alone, on the user's own words, and
nothing below touches any of the three. See
`docs/architecture/CURRENT_STATE.md` ("Hardening pass, Module 45") for
the full write-up, including exactly what was checked before each fix
and why the two npm audit findings left unfixed are staying that way.

- **keke-platform's npm audit: 3 high severity findings, all from the
  same root cause, down to 0.** `@prisma/config`, `deepmerge-ts`, and
  `prisma` were all flagged over one real vulnerability
  (GHSA-ggr8-5vv4-36mx, a stack-exhaustion bug in `deepmerge-ts@7.1.5`,
  a dependency of Prisma's own config loader). `npm audit`'s own
  suggested fix was a downgrade to an older Prisma release, not a real
  fix, and checking further found even the latest stable Prisma still
  pulls the same vulnerable `deepmerge-ts` version, there is currently
  no fix available through a Prisma version bump at all. Fixed instead
  with a targeted `"overrides": { "deepmerge-ts": "^8.0.2" }` in
  `package.json`, after checking `deepmerge-ts@8.0.2`'s `package.json`
  against `7.1.5`'s and finding an identical CJS/ESM export shape (a
  safe override, not a guess). `npm audit` now reports 0 vulnerabilities.
  Verified `npm install`, `npx vitest run` (80/80), `npx eslint .`, and
  directly exercised the Prisma CLI itself (`npx prisma --version`,
  `npx prisma validate`, both of which load config through
  `deepmerge-ts` internally) to confirm nothing broke, both reached the
  exact same pre-existing `binaries.prisma.sh` network-blocked failure
  this sandbox already had before the override, not a new one.
- **keke-mobile's npm audit: 14 moderate severity findings down to 3.**
  All 14 traced back to two separate leaf packages: `uuid@7.0.3` (pulled
  in by `xcode`, pulled in by `@expo/config-plugins`, pulled in by
  `expo-splash-screen`) and `decode-uri-component@0.2.2` (pulled in by
  `query-string`, pulled in by `expo-router`). `uuid` fixed the same way
  as `deepmerge-ts` above: `"overrides": { "uuid": "^11.1.1" }`,
  confirmed safe with a scratch-project `require('uuid')` smoke test
  first (the package `xcode` uses it from, `pbxProject.js`, does a plain
  `require`, compatible with 11.1.1's CJS export). That one override
  alone dropped the count from 14 to 3, since most of the other 13
  findings were npm audit flagging everything upstream of `uuid` as
  "vulnerable" too, not 13 separate bugs. The remaining 3
  (`decode-uri-component`, `query-string`, `expo-router`) are staying
  as disclosed, not fixed: the only non-vulnerable
  `decode-uri-component` release, 0.5.0, dropped CommonJS support
  entirely (confirmed with the same kind of smoke test, `require()`
  throws under 0.5.0), and `query-string@7.1.3` (pinned by
  `expo-router@57.0.18`) requires it with plain `require()`. Forcing
  that override would be a real breaking change this sandbox has no way
  to verify against an actual Metro bundle, so it was left alone rather
  than forced blind.
- **keke-mobile's Supabase session is now encrypted at rest.**
  `src/lib/file-storage.ts` (the `expo-file-system`-backed storage this
  project uses in place of AsyncStorage, see that file's own comment for
  why) used to hold the session as plain JSON on disk. New file
  `src/lib/secure-session-storage.ts` implements Supabase's own
  documented "LargeSecureStore" pattern for React Native: a random
  AES-256 key is generated on every write (`aes-js` for the cipher,
  `react-native-get-random-values` for `crypto.getRandomValues`, neither
  previously installed), that key goes into `expo-secure-store`
  (hardware keychain on iOS, Keystore on Android, comfortably under its
  size limit), and the actual session ciphertext goes through the
  existing `file-storage.ts`, which never sees anything but ciphertext
  now. `src/lib/supabase.ts` now points `auth.storage` at
  `SecureSessionStorage` instead of `FileSystemStorage` directly, its
  comment updated to match. Verified `npx tsc --noEmit` and
  `npx eslint .`, both clean; not verified on a real device from this
  sandbox, the recommended check on a real phone is sign in, force-quit
  the app, relaunch, confirm the session is still there, since that's
  exactly the round trip through the new encrypt/decrypt path that
  matters.
- **Admin-initiated password resets already force-sign-out every other
  device, no code change needed.** This was an open question, not
  assumed either way: checked what `resetInvestorPassword`,
  `resetStaffOrAgentPassword`, and `resetDriverPassword`
  (`lib/actions/investors.ts`, `staff.ts`, `drivers.ts`) actually call,
  all three go through
  `supabaseAdmin.auth.admin.updateUserById(authId, { password })`, then
  checked current, real Supabase Auth (GoTrue) server behavior for that
  exact call. As of a recent GoTrue server version (somewhere after
  v2.149, per a still-open supabase/auth GitHub issue, #1579),
  `updateUserById` with a new password now kills that user's existing
  session immediately, a behavior change from older versions, not
  something documented as a guaranteed contract, but real and current on
  hosted Supabase projects (which auto-update). Since every hosted
  Supabase project runs a current server version, this app's three
  admin-reset paths already get this for free, nothing to build. Flagged
  in `docs/architecture/CURRENT_STATE.md`'s Known gaps as resolved, with
  the caveat that it rides on Supabase's own server behavior rather than
  anything this app's code guarantees, worth a real check on the user's
  own project (reset a password from the admin panel while signed in as
  that user on a second device or browser, confirm the second session
  gets kicked).
- **A real Content-Security-Policy, nonce-based.** Round seven's
  security audit added five response headers (`X-Frame-Options` and
  friends, `next.config.ts`) but explicitly left CSP out: this app ships
  one inline `<script>` (the dark-mode theme-init script,
  `app/layout.tsx`), and a CSP strict enough to matter blocks inline
  scripts unless they carry a matching nonce. Built following Next.js's
  own documented App Router pattern: `proxy.ts` now generates a fresh,
  unpredictable nonce on every request and sets it on both the
  `Content-Security-Policy` response header and an `x-nonce` request
  header; `app/layout.tsx` reads that header back with `next/headers`
  and passes it to the theme-init `<Script>`'s `nonce` prop (Next.js
  nonces its own framework/page scripts automatically from the CSP
  header, this one hand-written script is the one exception that needs
  it passed explicitly). Every directive was checked against what this
  app actually loads rather than copied from a generic template,
  `proxy.ts`'s own comment has the full reasoning: `connect-src` allows
  this app's own Supabase project (the browser talks to it directly for
  sign-in/sign-up/MFA, checked in `lib/supabase/client.ts`) and Sentry's
  ingest domains; `img-src` allows `data:` for the MFA enrollment QR
  code; `style-src` needs `'unsafe-inline'` since nonces don't cover
  inline `style=""` attributes at all (only `<style>` elements), and
  this app has real dynamic ones (progress bar widths, per-row status
  colors); Paystack needed nothing, every Paystack call in this app is
  server-side only. Nonce-based CSP requires every page to render
  dynamically, already true here, virtually every route already reads
  the signed-in user's session via `getCurrentUser()`, and the new
  `headers()` read in the root layout covers the handful of public pages
  that didn't. Not verified against a real running browser, this
  sandbox has no live one attached to this app: watch the browser
  console for CSP violation reports after this ships, especially around
  sign-in/sign-up/MFA and the QR code step.
  **Hardened further, Module 55, well above**: the nonce now comes from
  real random bytes rather than a re-encoded UUID, and violations now
  report to Sentry automatically instead of only showing up in whichever
  browser console someone happens to have open.
- **The Google-hosted font is now self-hosted, and it fixes the
  sandbox's `next build` block.** `next build` has never completed in
  this sandbox, its egress policy blocks `fonts.googleapis.com` and
  `fonts.gstatic.com` outright (confirmed directly with `curl`, a 403 on
  the CONNECT tunnel itself, an org policy, not anything wrong with the
  app), and `next/font/google` needs to reach those at build time even
  though it serves the downloaded files from this app's own origin
  afterward, never from Google at runtime. Swapped
  `next/font/google`'s `Plus_Jakarta_Sans` for `next/font/local`,
  pointing at the same font's actual `.woff2` files (all five weights
  this app uses: 400/500/600/700/800, latin, normal), pulled from the
  `@fontsource/plus-jakarta-sans` npm package (same SIL Open Font
  License, same upstream font, just fetched through the ordinary npm
  registry instead of Google's CDN) and checked into
  `app/fonts/plus-jakarta-sans/` (license file included). Output is
  identical either way, same `--font-plus-jakarta-sans` CSS variable
  nothing else in the app had to change for. This did fix the font
  block: a real `npm run build` now gets past font loading and into
  Next's own type-checking step, further than it has ever gotten in
  this sandbox. It still can't finish here, though, blocked by the
  already-known, separate limitation that `npx prisma generate` also
  can't reach `binaries.prisma.sh` from this sandbox (confirmed again,
  including the documented `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`
  offline escape hatch, which gets one step further before hitting the
  same 403 on the actual engine binary), leaving the checked-in Prisma
  Client stale and the type-check step failing on errors already
  well-understood as that staleness (implicit-any callback parameters,
  "has no exported member" errors), not anything new. This is the same
  baseline `npx tsc --noEmit` already showed before this batch, cross
  checked file-for-file, nothing in this batch's own changed files
  appears in it. On the user's own machine, where `binaries.prisma.sh`
  is reachable, running `npx prisma generate` (already documented as a
  required setup step) then `npm run build` should now complete
  cleanly, since the one blocker this sandbox couldn't work around is
  gone.

## Previously delivered (Module 44: Payout details and Documents moved inside investor Settings)

Direct feedback: "in the web the payout details is should be inside the
settings, documents should also be inside the settings, change password
should also be inside the settings, so when a user click on the profile
or investor's name it should open the settings." See
`app/investor/settings/page.tsx`'s own comment in
`docs/architecture/CURRENT_STATE.md` ("Investor Settings hub, Module 44")
for the full write-up.

- **"Payout details" and "Documents" are no longer their own top-level
  sidebar items on the investor portal**, they're now two rows inside
  `/investor/settings`, under a new "Payments" section, the same
  navigate-away-chevron shape the existing "Password" row already used
  to reach `/change-password`. Both keep their own real routes
  (`/investor/payout-details`, `/investor/documents`) unchanged, still
  reachable from their other existing links elsewhere in the app
  (`/investor/wallet`'s "Add bank details," `/kyc`'s "Payout details"
  link), only the sidebar entry is gone. The investor sidebar is now
  five items instead of seven: Dashboard, My Investments, Payments,
  Wallet, Settings.
- **Change password was already inside Settings**, as the existing
  "Password" row, no change needed there, just confirming it as part of
  this request.
- **Clicking the sidebar avatar or investor name to open Settings was
  already true too**, since round twelve's `profileHref` addition to
  `AppShell`. Nothing to change, this module is the two rows above plus
  removing their old sidebar entries.
- Two new field icons, `BankFieldIcon` and `DocumentFieldIcon`
  (`components/design-system/settings-icons.tsx`), reusing the same
  shapes the removed sidebar items used, resized to this file's
  18x18/1.6-stroke convention.

**Module 44 follow-up**, direct feedback: "i think it should be scoop to
all the web app," after the first delivery above only touched the
investor portal. Audited the other three portals
(`app/agent/layout.tsx`, `app/driver/layout.tsx`, `app/admin/layout.tsx`
and its `/admin/settings` hub) against the same three asks. Two were
already true everywhere: every portal's sidebar avatar/name already
opens that portal's own settings page (`profileHref` on `AppShell`,
since round twelve), and "Password" already lives inside Settings on
every one of them, never its own sidebar item. The third, "Documents"
and "Payout details" living outside Settings, turned out to be an
investor-only problem in the first place: KYC documents and a payout
bank account are personal-account concepts unique to investors, agent,
driver, and staff/Admin accounts have no equivalent sidebar item to
move, their sidebars (Agent: Dashboard, My Vehicles, Remittances,
Settings; Driver: Dashboard, My Deposits, Settings; Admin: Settings is
already a hub with its own "Security" tile) never had this gap. No code
changes needed on the other three, this follow-up is the audit trail
confirming that.

**Module 44 follow-up, round two**, direct feedback: "i have seen the
cards but is just by the left hand side only, it doesnt look good, make
it look good." Every one of the four portal settings pages
(`app/investor/settings/page.tsx`, `app/agent/settings/page.tsx`,
`app/driver/settings/page.tsx`, `app/admin/settings/security/page.tsx`)
wrapped its `SettingsGroup` cards in a fixed `max-w-[560px]` column with
no centering, pinned to the left edge, leaving a large empty gap on any
screen wider than that. Fixed with a responsive `lg:grid-cols-2`, the
same pattern `/admin/settings/contract-terms` already uses for more
content than fits one column: below `lg` everything still stacks in one
column exactly as before, at `lg` and up the investor page puts
"Personal data" in the left column and "Payments" plus "Security" in
the right, the other three portals (only two groups each) put "Personal
data" and "Security" side by side. Each column lands close to the
original 560px card width, so no row gets any harder to read, the page
now just uses the width it actually has.

## Previously delivered (Module 43: the throw-inside-a-plain-form-action sweep, finally done for good)

The bug shape flagged as this codebase's "single most consistent bug
shape" back in Module 26's Known gaps entry, and fixed reactively six
more times since across Modules 25-27, finally got its dedicated sweep.
See "Server Actions and form safety (Module 43)" in
`docs/architecture/CURRENT_STATE.md` for the full write-up.

- **A Server Action that threw a real, user-facing error while bound to
  a plain `<form action={fn}>` crashed to Next's generic error boundary**
  instead of showing a friendly inline message, the same shape found and
  fixed one crash report at a time in Modules 25-27
  (`bootstrapFirstAdmin`, `retryAgentCollectionAccount`,
  `updatePayoutDetails`, `matchProviderTransaction`,
  `dismissProviderTransaction`, `createPaymentBatch`). A general-purpose
  agent audited every `lib/actions/*.ts` file for the shape first: 32
  unsafe functions across 13 files, all converted this module from
  throwing to returning `{ error?: string }`.
- **New shared `components/ui/action-form.tsx`** replaces 32 bespoke
  wrapper components that would otherwise have been needed one per call
  site. `<ActionForm action={fn}>` binds `onSubmit` instead of a native
  `action={fn}`, calls the Server Action directly, and shows a returned
  error inline; its children can be a render-prop
  `({ isSubmitting, error }) => ...` for callers that need a submit
  button's loading state, replacing `useFormStatus()`'s `SubmitButton`
  (which only works with a native form-action binding) with
  `Button loading={isSubmitting}`. It deliberately never wraps the
  action call in its own try/catch, `redirect()` throws a special
  Next.js digest error a surrounding catch would wrongly swallow, and
  `redirect()`/`revalidatePath()` already work the same whether an
  action is bound natively or called directly, proven by the pre-existing
  `NewBatchForm` reference component.
- **`retryDriverCollectionAccount` (`lib/actions/drivers.ts`) had never
  actually received the Module 25 fix** its siblings
  (`retryAgentCollectionAccount`, `retryInvestorCollectionAccount`) got,
  still throwing on a Paystack failure instead of redirecting back with
  the real message. Fixed to match its siblings exactly, and
  `/admin/drivers` gained the same `collectionAccountError` banner
  `/admin/settings/staff` and `/admin/investors/[id]` already had.
- Auth and role-check throws (`if (!user) throw ...`, `!user.investor`,
  `!user.staff`, `ForbiddenError`/`requirePermission()`) were
  deliberately left as real throws, matching this codebase's own
  established precedent: the real, permission-gated UI never lets an
  unauthorized or wrong-role account reach these forms at all.

## Previously delivered (Module 42: real stat/vehicle icons, dark mode, chart fix, responsiveness, and Profile/Security cleanup)

A batch of direct feedback covering both apps at once. See "Icons, dark
mode, chart fix, and Profile/Security cleanup (Module 42)" in
`docs/architecture/CURRENT_STATE.md` for the full write-up.

- **Vehicle images now show on the web app, not just mobile.** A new
  `components/design-system/vehicle-illustrations.tsx` ports the mobile
  app's wide, multi-color `VehicleTypeIllustration` set to the browser
  (same coordinates, plain `<svg>` instead of `react-native-svg`), wired
  into the investor dashboard's "My vehicles" cards and
  `components/fleet/keke-card.tsx`. The existing small single-tone
  `VehicleTypeIcon` (`vehicle-icons.tsx`) is untouched, it is still the
  right choice for compact badges.
- **The four investor stat cards (Total invested, Total realized,
  Outstanding, Active investments) get real icons**, replacing one
  generic recolored vertical line shared by three of the four cards. New
  `components/design-system/stat-icons.tsx`: a coin stack, a coin
  dropping into a tray, a clock, and a briefcase, each chosen for what
  the number actually means. `keke-mobile` gets the same four icons in
  `src/components/icons.tsx`, wired into the Home screen's `StatTile`.
- **The payout trend chart no longer overflows its card on the web
  app.** `components/charts/area-trend-chart.tsx`'s `<svg>` used an
  explicit pixel height inside a `w-full` box, letting its rendered
  height drift from its intended aspect ratio in some contexts; it now
  renders inside a `aspect-[14/5]` wrapper with `preserveAspectRatio="none"`,
  which structurally guarantees the box can never exceed the intended
  ratio. The mobile equivalent (`payout-trend-chart.tsx`) was checked and
  does not reproduce the bug, react-native-svg's explicit `height` prop
  already gives it a definite size regardless of its parent.
- **Light/dark mode on both apps.** Web: every color already routed
  through a CSS custom property in `app/globals.css`, so dark mode is a
  second set of the same property names under `[data-theme="dark"]`
  (warm charcoal, matching the brand's own hero gradient, not a generic
  near-black), a `beforeInteractive` init script in `app/layout.tsx` sets
  the attribute before first paint (localStorage, falling back to
  `prefers-color-scheme`), and a new `ThemeToggle`
  (`components/layout/theme-toggle.tsx`, reads state with
  `useSyncExternalStore` rather than a mount-time effect) sits in
  `AppShell` so every logged-in page gets it at once. Mobile:
  `src/constants/theme.ts` now exports `LightColors`/`DarkColors`
  instead of one static `Colors` (a deliberate breaking change used as a
  compiler-driven checklist), a new `src/context/theme-context.tsx`
  provides `useTheme()` (OS preference via `useColorScheme()`, an
  explicit override persisted through the existing `FileSystemStorage`
  helper, the same one `src/lib/supabase.ts` already uses, chosen
  specifically because AsyncStorage doesn't resolve under this project's
  Expo SDK 57 / Expo Go setup), and every screen was migrated off the
  static import.
- **The web app is now responsive.** `components/layout/app-shell.tsx`
  (used by every logged-in page in every portal) was a fixed 240px
  sidebar with no narrower layout at all; below the `lg` breakpoint it is
  now an off-canvas drawer behind a hamburger button, closing itself on
  navigation. An audit of the rest of the app (grid breakpoints, fixed
  widths, table scroll wrappers) found the existing page-level
  conventions already responsive; the shell was the real gap.
- **Phone number moved from Security to Profile on the mobile app**,
  direct feedback that phone doesn't belong next to password/2FA.
  `src/app/security.tsx` now only covers password and two-factor
  authentication; the phone number editor moved to
  `src/app/(app)/profile.tsx`. (Web has no equivalent "Profile" page
  today under this navigation, this move was mobile-scoped; ask if you
  also want an equivalent restructure on the web app.)
- **Animations**: mobile app first launch (`src/app/index.tsx`) now
  scales and fades in the Ultimate mark instead of showing a bare
  spinner while auth state resolves, and the root navigator cross-fades
  between the signed-out and signed-in worlds (`animation: 'fade'` on
  `index`/`sign-in`/`(app)`) instead of a horizontal push, covering both
  "login in" and "login out." On the web, `/sign-in` and
  `/admin-sign-in` now settle onto the page with a short entrance
  animation on first paint, the same page `SignOutButton` redirects back
  to.

**Module 42 follow-up fixes**, from testing the delivered batch above:

- **A real crash on the mobile Profile screen** (`[expo-router]: You are
  passing an array of styles to a child of <Slot>`): the Security and
  Bank account rows passed an array `style` prop straight to a `<Link
  asChild>` child, which `expo-router`'s `<Slot>` refuses outright. Fixed
  with `StyleSheet.flatten(...)`, matching the pattern the Home screen's
  own wallet-balance link already used.
- **Admin dashboard's seven stat cards** (Total vehicles, Active fleet,
  In maintenance, Investment value, Inflow/Outflow/Net this month) all
  reused `KekeIcon`, the app's own logo mark, recolored per card, the
  same bug already fixed on the investor dashboard in Module 42 itself.
  Six new icons in `components/design-system/stat-icons.tsx`
  (`FleetIcon`, `ActiveFleetIcon`, `MaintenanceIcon`, `InflowIcon`,
  `OutflowIcon`, `NetIcon`; "Investment value" reuses `InvestedIcon`)
  replace it.
- **`/admin/reports`'s "Inflow/Outflow by day" charts were illegible**,
  every day in the selected range (30 by default) got its own x-axis
  label, all crammed into the same width. `AreaTrendChart` now shows at
  most 7 evenly-sampled labels regardless of how many data points it's
  given.
- **The "last 8 weeks" charts showed week numbers ("W34") instead of a
  date.** `buildWeeklyTrend` (`lib/data/chart-helpers.ts`, shared by the
  admin, investor, agent, and driver dashboards, and by extension the
  mobile app's investor summary) now labels each bucket with the actual
  date its week starts on.

**Module 42 follow-up fixes, round two**, from continued testing:

- **"Upcoming payments" could show a date that had already passed.**
  `getInvestorDashboardData`/`getInvestorPaymentHistory`
  (`lib/data/investor.ts`) used to collapse every DUE/PARTIALLY_PAID
  schedule entry into "UPCOMING" regardless of its actual due date, there
  is no OVERDUE value in the `ScheduleEntryStatus` Prisma enum to read
  this off of. `mapScheduleStatus` now compares the entry's due date
  against the current time and sorts a late one into a new OVERDUE
  status instead, computed at read time on every request. This reaches
  every surface that reads payment status: the investor dashboard (web
  and, via the shared `/api/v1/investor/summary` route, mobile) now has a
  "Missed payments" section, `/investor/payments` (and mobile's Payment
  History screen) badge a late entry "Missed" instead of "Upcoming", and
  a vehicle whose contract has a missed-but-not-deferred payment shows a
  "Payment overdue" badge distinct from "Payment deferred" (a staff
  decision) on the dashboard, `/investor/investments`, and their mobile
  equivalents.
- **Payment schedule generation was checked against the report that the
  upcoming-payment calculation "doesn't track the actual payment."**
  `lib/schedule.ts`'s `generateScheduleDates` already lays out due dates
  correctly per contract for whichever frequency it was actually written
  with (weekly, biweekly, or monthly, see `lib/schedule.test.ts`), it was
  not hardcoded to weekly. The real bug was the OVERDUE gap above, not
  the schedule math. Note the platform has no "daily" payment frequency,
  only weekly/biweekly/monthly (`PaymentFrequency` in
  `prisma/schema.prisma`); every payment-list row used to say "Week N"
  regardless of a contract's actual cadence, which is now "Payment N"
  everywhere, and the investor dashboard's per-vehicle installment figure
  now labels itself Weekly/Biweekly/Monthly instead of assuming weekly.
- **No way to change a vehicle's own status from `/admin/fleet/[id]`.**
  Direct feedback: "after clicking the fleet from the admin there is no
  place to change or set the fleet to maybe under maintenance." A vehicle's
  `VehicleStatus` was only ever set once, at creation. A new
  `updateVehicleStatus` action (`lib/actions/fleet.ts`) and a status
  `<select>` on the vehicle detail page (staff with fleet-manage
  permission only) let it be changed to Active, Maintenance, Unassigned,
  Pending onboarding, or Retired at any time.
- **Mobile's payouts chart looked unchanged** even though the week-to-date
  label fix above had already reached it. `PayoutTrendChart` never
  accepted per-point labels at all, only the "latest" callout badge, so
  the axis itself stayed blank while the web chart gained visible dates.
  It now takes a `weeks` prop and renders the same evenly-sampled date
  labels the web `AreaTrendChart` does.
- **New: a swipeable vehicle carousel on mobile Home.** "My vehicles" used
  to show only the first vehicle plus a "+N more on the Fleet tab" note.
  It's now a horizontally swipeable row of every vehicle the investor
  holds, sized so the next card peeks in at the edge as a swipe hint.
- **New: a per-vehicle payment history screen on mobile.** Tapping any
  vehicle card (on Home's new carousel or the Fleet tab) opens
  `vehicle-detail.tsx`, showing that vehicle's full contract terms and its
  complete payment history from the start of the contract, filtered out
  of the same full payment list the cross-vehicle Payment History screen
  already fetches, no new API route needed.

**Module 42 follow-up fixes, round three**, from continued testing of round two's delivery:

- **The admin dashboard's "Realized payments" chart still looked like it
  wasn't filling its card**, this time on a wide desktop screen rather
  than mobile. `AreaTrendChart`'s wrapper sized itself purely by
  `aspect-[14/5]`, height following width at a fixed ratio with no cap;
  at the dashboard's roughly 930px content width that computes a ~330px
  tall box, and since the plotted line only rises as high as the data's
  own peak (most weeks well below it), that left a large blank gap above
  the line on a wide screen. A `max-h-[200px]` cap now keeps the box from
  growing past the chart's native height regardless of card width, safe
  because `preserveAspectRatio="none"` already lets the `<svg>` stretch
  to any box non-uniformly without distortion.
- **The admin dashboard's search bar did nothing.** It was a decorative
  `<div>` with placeholder text and a magnifier icon, no `<input>` at
  all. A new `GlobalSearch` client component
  (`components/admin/global-search.tsx`) and `searchAdmin` Server Action
  (`lib/actions/search.ts`) now back it for real: type two or more
  characters and it searches investors (by name or email), vehicles (by
  asset tag, plate, or frame number), and payment batches (by period
  label), each section gated by the same `*_VIEW` permission its own list
  page already requires, debounced 250ms, with a dropdown of results
  linking straight to `/admin/investors/[id]`, `/admin/fleet/[id]`, or
  `/admin/payments/batches/[id]`.

**Module 42 follow-up fixes, round four**, from continued testing of round three's delivery:

- **Clicking an investor's name in search results "leads to no where."**
  `/admin/investors/[id]` (`getInvestorById`, `lib/data/onboarding.ts`)
  used to return only the fields the edit form and bank account cards
  needed, an investor's actual contracts and payment history lived
  nowhere on the page. Direct feedback: "it should lead to that
  investor entire history with the company, his/her investment,
  payment history, his bank account and other details literally
  everything about him/her." `getInvestorById` now also returns every
  contract the investor holds (vehicle, progress, principal/target/
  realized/installment figures, frequency, start date) and their
  complete payment schedule history across every contract, newest
  first, labeled OVERDUE/PAID/DEFERRED/UPCOMING through the same
  `mapScheduleStatus` (`lib/data/investor.ts`) the investor's own
  dashboard uses, so one payment never reads "Missed" to the investor
  and "Upcoming" to staff looking at the same row. The page itself
  gained a stats grid (total invested, total realized, outstanding,
  wallet balance), an "Investments" section with a card per contract
  (linking to that vehicle's own fleet detail page, a progress bar, and
  its figures), and a "Payment history" table of every schedule entry,
  above the existing edit form and bank account sections, which were
  left as they were.
- Since a genuine click/navigation bug could not be ruled out purely by
  reading the code (no live browser available in this sandbox to
  reproduce it directly), `components/admin/global-search.tsx` also
  picked up a defensive fix alongside the page rebuild: a
  `usePathname()`-keyed effect now resets the dropdown only once the
  route has actually changed, a belt-and-suspenders backstop next to
  each result link's own click handler, in case any click-timing race
  was ever preventing navigation. If a click there still visibly does
  nothing after this, that would point to something this sandbox
  cannot see from code alone (a browser console error, or a dev server
  that needs a restart), worth checking next.

**Module 42 follow-up fixes, round five**, from the round four delivery's actual
error screenshots:

- **The click was never the problem, the destination page was crashing.**
  The screenshots showed Next.js's own dev error overlay, "Something went
  wrong," which only appears when a Server Component throws while
  rendering, not from a routing or click issue at all. `getLatestBankChangeRequest`
  (`lib/data/onboarding.ts`) threw `Cannot read properties of undefined
  (reading 'findFirst')` on `prisma.investorBankChangeRequest`, this
  model and its migration both already exist in `prisma/schema.prisma`
  and are consistent with every other place in this codebase that reads
  the same table, so the model itself is not the bug. This means the
  Prisma Client actually loaded on the machine running `next dev` does
  not expose it yet, most likely because `npx prisma generate` has not
  been re-run there since that model's migration
  (`20260903130000_add_investor_deposits_and_bank_change_requests`) was
  applied, or the dev server process itself predates that regeneration
  and is still holding the old generated client in memory. This sandbox
  cannot run `npx prisma generate` itself (it needs `binaries.prisma.sh`,
  blocked here, see "Known gaps"), so this needs running for real:
  `npx prisma generate`, then a full stop and restart of `npm run dev`
  (not just a hot reload) so the long-lived dev process picks up the
  freshly generated client.
- **A second, separate issue in the same screenshots: a hydration
  mismatch on `data-theme` on `<html>`.** The Module 42 theme-init script
  sets `data-theme` on the DOM directly, before React hydrates, so the
  server-rendered markup and the first client render never agree on that
  one attribute, this is the known, documented tradeoff of every "no
  flash of the wrong theme on load" script, not a bug in the theme logic
  itself. `app/layout.tsx`'s `<html>` now carries
  `suppressHydrationWarning`, the standard fix, which only silences a
  mismatch on `<html>`'s own attributes, nothing inside `<body>` is
  affected.
- **New: clickable feedback and animation on every search result.**
  Direct feedback: "add some clickable effect and animations after
  clicking on the investor from the search bar." Every result row
  (`components/admin/global-search.tsx`, new `ResultRow` component) now
  gets `active:scale-[0.97]`, the same instant, pure-CSS press feedback
  `components/ui/button.tsx` already uses on every `Button`, so a click
  or tap registers visually before any JavaScript even runs. Clicking a
  result no longer closes the dropdown immediately either, it now stays
  open with that one row highlighted and spinning until the route
  actually changes (the existing `usePathname()` effect, previously only
  a defensive backstop, now does this for real), so there is always
  something on screen between the click and the next page painting,
  rather than the dropdown vanishing into a blank gap.

**Module 42 follow-up fixes, round six**: the investor portal's last
outstanding item closed, then the agent portal's turn, direct ask: "go
ahead and finish the outstandings from the investor web/mobile then
proceed to the agent."

- **Investor: mobile magic-link sign-in wired up for real.** The last
  concrete "Known gap" item for the investor portal
  (CURRENT_STATE.md): the mobile sign-in screen's "send a login link by
  email" button was a "coming soon" placeholder, `checkMagicLinkBlocked`
  (`lib/actions/auth.ts`) only existed as a Server Action, unreachable
  from `keke-mobile`. New `POST /api/v1/auth/check-magic-link` route
  (deliberately the one route that does not call
  `authenticateApiRequest` first, there is no signed-in user yet at this
  point) wraps it, callable over plain HTTP with just an email. Mobile's
  `sign-in.tsx` now calls it before `supabase.auth.signInWithOtp`, the
  same two-step order the web sign-in page already uses, so an account
  with two-factor authentication turned on still can never get a magic
  link that would skip its second factor, on either app now.
- **New: a real GET /api/v1/agent/summary route.** The first of the
  "staff, agent, and driver portals still have no equivalent endpoint"
  gaps to actually close, agent specifically. Mirrors
  `GET /api/v1/investor/summary` exactly: authenticate, check for an
  agent profile, return `getAgentDashboardData` (the same function
  `app/agent/dashboard/page.tsx` already calls) as JSON, no business
  logic duplicated.
- **New: the agent portal is real on mobile now, not a placeholder.**
  Home, Fleet, and Wallet all previously showed "your dashboard is on
  its way" for agent accounts, the same message every non-investor
  portal got. They now show real data for agent accounts specifically:
  the agent's Paystack collection account (account number, bank,
  remittance instructions), this week's target vs. what has actually
  come in (with a paid-percent badge), an 8-week remittance trend chart
  (`PayoutTrendChart`, reused, fed `remittanceTrend` instead of
  `payoutTrend`), and every vehicle currently assigned to the agent with
  its latest schedule entry's amount, date, and paid/pending status.
  Staff and driver accounts still see the original "on its way"
  placeholder, neither portal has a backing endpoint yet.

**Module 42 follow-up fixes, round seven**: direct ask, "on the staff, i
dont know if it is a good idea to have them use the mobile app...
staff or admin should use the webapp, what do you think?" plus
"complete or finish up the agent," "finish up the investor too," and
"make sure this web/mobile app are very secure against attack... fix
the password stuff too."

- **Staff and admin accounts can no longer sign into keke-mobile at
  all.** Agreed with the project owner's own instinct, and taken a step
  further than just leaving Fleet/Wallet as an empty placeholder for
  them: staff and admin work is not mobile-first the way an investor,
  agent, or driver's is, and a privileged, permission-bearing session
  sitting on a phone is attack surface worth removing outright.
  `GET /api/v1/me` now refuses a staff/admin account with
  `403 STAFF_PORTAL_NOT_SUPPORTED` instead of handing back its profile,
  the one route that actually mattered since every other `/api/v1`
  route already only serves whichever of investor/agent/driver the
  caller has. `keke-mobile`'s auth context catches that specific error
  code (never by matching message text) wherever a staff session could
  exist on a device, a stale one already there, a fresh password
  sign-in, or a fresh magic-link sign-in, and force-signs the device
  out the moment it sees it, showing "Staff and admin accounts sign in
  at the Ultimate web app, not here" on the sign-in screen. The
  sign-in screen's audience tab that used to read "Staff · Agent ·
  Driver" now reads "Agent · Driver."
- **Real self-service password reset closed the two concrete gaps that
  were actually there**, `keke-mobile` had no reset flow at all and
  `/admin-sign-in` had no "Forgot password?" link, both now fixed
  without inventing a second reset system: `/forgot-password` and
  `/reset-password` (Module 13) already existed and already worked,
  the actual gaps were narrower than "build password reset." `/admin-sign-in`
  now links to `/forgot-password` next to its password field, same as
  `/sign-in` already does. `keke-mobile`'s "Forgot password?" was a
  static "ask an administrator" alert; it now calls
  `supabase.auth.resetPasswordForEmail` directly and points the emailed
  link at the web app's existing `/reset-password` page rather than
  building a second, native version of that same short-lived flow, the
  same non-enumeration "same outcome either way" behavior the web page
  already uses. Separately, and researched rather than assumed:
  `/reset-password` now calls `supabase.auth.signOut({ scope: "others" })`
  right after a successful password update, before its existing final
  sign-out, closing the self-service half of the Module 30 "doesn't sign
  out other devices" disclosed gap, the admin-initiated reset path
  (`auth.admin.updateUserById`) still has no equivalent, see
  CURRENT_STATE.md's Known gaps for the honest, narrowed version of that
  entry.
- **A real security audit, not a reassurance pass**, direct ask: "make
  sure this web/mobile app are very secure against attack." Checked
  systematically rather than sampled: every exported function in
  `lib/actions/*` (every Server Action in the app) cross-referenced
  against `requirePermission`/`user.permissions.has(...)` calls, every
  `app/api/v1/*` route re-read for the same, and every investor-facing
  route confirmed to scope its data off `user.investor.id` (the
  authenticated caller's own record, derived from their bearer token)
  rather than an ID taken from the request, the standard shape an
  IDOR (insecure direct object reference) vulnerability takes. Also
  checked: no `$queryRaw`/`$executeRaw` anywhere (Prisma's parameterized
  query builder is used for every database call, no hand-built SQL to
  get wrong), no `dangerouslySetInnerHTML` anywhere (no XSS surface from
  rendering untrusted HTML), the Paystack webhook's signature check
  (`verifyPaystackSignature`) is real, timing-safe, and unit-tested, not
  just asserted. All of that came back clean, genuinely solid, not
  something this round needed to fix. What it did find and fix: this
  app sent zero security response headers before this, Next.js sets
  none by default. `next.config.ts` now sets `X-Frame-Options: DENY`
  (this app approves real payments and admin actions, it should never
  be embeddable in someone else's `<iframe>`), `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a
  `Permissions-Policy` turning off camera/microphone/geolocation/payment/
  usb (none of which this app uses), and `Strict-Transport-Security`.
  Deliberately NOT added: a real Content-Security-Policy, this app ships
  one inline `<script>` (the Module 42 theme-init script that sets
  `data-theme` before hydration to avoid a dark-mode flash), a CSP
  strict enough to actually matter would block it unless nonce-based, a
  bigger change this sandbox has no running browser to verify against,
  see CURRENT_STATE.md's Known gaps for the honest disclosure of that
  plus two other findings (dependency CVEs, and mobile's session storage)
  that needed the project owner's own machine to verify rather than a
  blind fix here.

**Module 42 follow-up fixes, round eight**: direct ask, "yes start the
driver," the last of the three mobile portals that still showed the
generic "your dashboard is on its way" placeholder. Same deliberate
pattern round six used for agent: a new `/api/v1` route pair mirroring
the web driver dashboard's own data functions, then real mobile screen
content built on top.

- **New: `GET /api/v1/driver/summary` and `GET /api/v1/driver/deposits`**,
  closing the driver half of the "no equivalent endpoint" gap the
  agent route closed in round six. Identical shape and auth pattern to
  the investor and agent routes, returning exactly what the web driver
  dashboard and deposits page already compute (`lib/data/driver.ts`),
  no business logic duplicated.
- **The driver portal is real on `keke-mobile` now.** Home, Fleet, and
  Wallet show the driver's Paystack collection account (with the same
  3-step explanation the web dashboard uses), their one current vehicle
  (not a fleet, unlike agent), "Received, all time," the 8-week deposit
  trend, and recent deposits, with a new `driver-deposits.tsx` screen
  for the uncapped history, mirroring `agent-remittances.tsx`. Every
  portal that can sign into `keke-mobile` (investor, agent, driver) now
  has a real dashboard; see "Mobile / external API" in
  `docs/architecture/CURRENT_STATE.md` for the full write-up.

**Module 42 follow-up fixes, round nine**: direct hands-on testing of the
driver portal on a real phone and the web sign-in page caught three real
issues, all fixed.

- **`keke-mobile`: sign-in used to redirect into the app before it knew
  which portal the account belonged to.** The instant Supabase confirmed
  a password was correct, `sign-in.tsx` redirected into `(app)`, but
  `GET /api/v1/me` (the call that actually determines investor vs. agent
  vs. driver) was still in flight, so for a beat you'd land on the
  generic "your dashboard is on its way" placeholder before your real
  portal content swapped in. `src/context/auth-context.tsx`'s `loading`
  flag now stays true for that window too, not just the very first app
  launch, and both `sign-in.tsx` and the root gate screen wait on it
  before redirecting.
- **Removed the "Investor" / "Staff, Agent, Driver" tabs on both apps'
  sign-in screens, they never actually gated anything and, on the web
  app, actively caused a bug.** Direct observation: selecting the
  "Investor" tab on mobile and signing in with driver credentials still
  correctly landed on the driver dashboard, because `GET /api/v1/me`
  never looked at which tab was selected in the first place, the tab was
  purely cosmetic there. The web app's equivalent tab was worse: the
  "Investor" tab (the default one) just pushed straight to
  `/investor/dashboard` with no check at all, so a staff, agent, or
  driver account signing in on that tab got a confusing "no investor
  profile" message instead of their real dashboard, even though the
  password was completely correct. Fixed by removing the tabs entirely
  on both apps and resolving the real portal directly instead: web's new
  `resolvePortalDestination` (`lib/actions/auth.ts`, replacing the old
  `resolveStaffPortalDestination`) now checks staff, agent, driver, and
  investor in one place, the same priority order `GET /api/v1/me`
  already used for mobile. One sign-in form now, whatever credentials
  you type, the system finds the right dashboard, no tab to get wrong.
- **A harmless but noisy console error on `/sign-in`: "A tree hydrated
  but some attributes of the server rendered HTML didn't match the
  client properties," pointing at `data-new-gr-c-s-check-loaded` and
  `data-gr-ext-installed` on `<body>`.** Both are Grammarly's browser
  extension writing attributes onto the page before React hydrates, a
  cause React's own hydration-mismatch docs name directly, nothing this
  app's code does and nothing wrong with what the server sent, it only
  shows up for a visitor with Grammarly (or a similar extension)
  installed. `app/layout.tsx` already had `suppressHydrationWarning` on
  `<html>` for the unrelated, legitimate dark-mode-flash mismatch (see
  the round four fix above), but that only covers one element deep, per
  React's own docs, so `<body>` needed its own. Added, with a comment
  explaining why, so a future reader doesn't mistake it for silencing a
  real bug.

**Module 42 follow-up fixes, round ten**: direct ask, "the driver should
have his/her own profile settings, for changing his phone number, etc."

- **`/driver/settings`, `/agent/settings`, and `/admin/settings/security`
  only ever had the two-factor authentication card, missing the same
  "Phone number" and "Password" cards `/investor/settings` got back in
  Module 39.** All three pages already existed and were already linked
  from each portal's own nav (Module 24 for driver/agent), just
  underbuilt. Nothing new needed building underneath, `updateOwnPhone`
  and `PhoneSettingsForm` were already portal-agnostic, and
  `/change-password` already works for any signed-in account, this
  wires the same two cards into all three pages, identical copy to the
  investor page. Driver was the direct ask, agent and staff/admin had
  the identical gap sitting right next to it, not something the project
  owner should have had to ask for three separate times. (`/driver/settings`
  and `/agent/settings` were named `/driver/security` and `/agent/security`
  at the time, renamed in round eleven below.)
- **Bug found in the process: `updateOwnPhone` only ever revalidated
  `/investor/settings`'s cache, written back when that was the only
  page calling it.** Once the other three security pages started
  calling it too, saving a new phone number there would show the old
  one again until the page's cache happened to expire on its own.
  Now revalidates all four portal security paths.

**Module 42 follow-up fixes, round eleven**: direct ask, "especially on
the web you should name the tab settings not security security should
inside settings."

- **Renamed `/investor/security`, `/agent/security`, and
  `/driver/security` to `/investor/settings`, `/agent/settings`, and
  `/driver/settings`, and their sidebar nav labels from "Security" to
  "Settings" to match.** `/admin/settings` was already a proper hub
  page (a "Settings" nav label linking to a page with "Security" as
  one tile among several, `/admin/settings/security`), exactly the
  shape the project owner wants "security living inside settings" to
  look like, and needed no change. The other three portals only ever
  had one settings-related page each, not enough to justify building a
  multi-section hub like admin's for each of them, so this is a plain
  rename rather than new structure: each page's header text changed
  from "Security" to "Settings" too, since the two-factor
  authentication card is now clearly one part of the page rather than
  the page's whole identity, matching what the page had already become
  once the Phone number and Password cards landed on it in round ten.
  `updateOwnPhone`'s four `revalidatePath` calls (`lib/actions/auth.ts`)
  were updated to the new paths, the `/admin/settings/security` one
  unchanged.

**Module 42 follow-up fixes, round twelve**: direct ask, after
keke-mobile's Profile tab got rebuilt around GTBank's own grouped
settings list (see keke-mobile's own README for that half): "you should
do something similar to the web app, make it as beutiful as the mobile
too, group them accordinly when one click on profile like that."

- **All four portal settings pages** (`/investor/settings`,
  `/agent/settings`, `/driver/settings`, `/admin/settings/security`)
  **rebuilt around two new shared components**, `SettingsGroup` and
  `SettingsRow` (`components/design-system/settings-list.tsx`): a
  rounded card of dividered rows (Tailwind's `divide-y`, no manual
  divider prop needed the way keke-mobile's React Native version
  needs one) instead of a separate bordered `Card` per field, an icon,
  a bold primary line, an optional muted second line, and either a
  chevron or a custom control on the right. Each page now shows two
  groups, "Personal data" (Full name, Phone number, Email, the first
  and last new here, this session's settings pages never showed a
  name or email at all before) and "Security" (Password, Two-factor
  authentication), five new icons
  (`components/design-system/settings-icons.tsx`) matching the icon
  language every sidebar in this app already uses, translated
  one-for-one from keke-mobile's own four new icons plus a new
  ProfileFieldIcon for the name row.
- **Two-factor authentication is a real toggle switch now**
  (`ToggleSwitch`, `components/ui/toggle-switch.tsx`, a `<button
  role="switch">`, not a checkbox styled to look like one), the web
  counterpart to keke-mobile's own new `ToggleSwitch`. `MfaSettings`
  (`components/account/mfa-settings.tsx`) was rebuilt to render as one
  row with the switch on the right, expanding the QR-code-and-verify
  form below itself, in the same card, only while enrolling. Turning
  it off is still a single click, that was already this component's
  behavior before this round.
- **Phone number editing is now `PhoneNumberRow`**
  (`components/account/phone-settings-form.tsx`): a plain display row
  (current number, "Phone number" caption) that expands the existing
  `PhoneSettingsForm` below itself when clicked, matching GTBank's own
  Personal data section being read-only until you actually go to
  change something, rather than always showing an open form the way
  this page used to.
- **The sidebar's avatar and name are now a link** to the signed-in
  account's own settings page (`AppShell`'s new `profileHref` prop,
  `components/layout/app-shell.tsx`, one per portal layout): "when one
  click on profile" now actually goes to the grouped settings screen
  above, the same way tapping the Profile tab does on keke-mobile.
  Previously that block was static, only the theme toggle beside it
  was clickable.

Direct feedback: an investor's own payout account number wasn't visible
anywhere in the app, and changing it should require staff approval like
everything else that touches money, not save instantly. Separately,
investors had no deposit account of their own, even though the same
Paystack Dedicated Virtual Account pattern already used for agent/driver
collections was the obvious fit, and no way to say whether a deposit was
"just top up my wallet" or "I'm buying a vehicle, please act on this."
See "Investor bank change requests and deposit accounts (Module 41)" in
`docs/architecture/CURRENT_STATE.md` for the full write-up, this entry
is a shorter summary.

- **Bank account changes are now maker-checker**, the same shape as a
  wallet withdrawal, not the instant save it used to be. New model
  `InvestorBankChangeRequest` (`PENDING_APPROVAL` -> `APPROVED`/
  `REJECTED`, or investor-cancelled). The investor requests a change from
  `/investor/payout-details` (still resolves the account with the bank
  first before it's ever submitted for review), a staff member decides
  from a new `/admin/wallet/bank-change-requests` queue (linked from
  `/admin/wallet`, gated `investors.manage`). Only the account number
  itself needs approval this way, the investor's `defaultPayoutDestination`
  (bank vs. wallet) toggle stays instant and self-service, unchanged, per
  the project owner's own answer when asked: that choice carries no fraud
  risk on its own, only the destination account number does.
- **Every investor now gets a Paystack Dedicated Virtual Account of their
  own**, provisioned the same way an agent's or driver's collection
  account already is, shown on `/investor/wallet` and, for staff, on
  `/admin/investors/[id]` (with a retry button for anyone created before
  this module).
- **A deposit into that account always credits the wallet, it never
  creates a contract by itself.** The existing, load-bearing invariant
  that a wallet balance only ever becomes a new vehicle contract through
  an explicit staff decision at `/admin/wallet/funding` is unchanged and
  was deliberately preserved. A deposit is a system-recorded wallet
  credit the moment Paystack confirms it, the same reasoning a held
  payout already had, nothing about that needs a human decision.
- **A standing "what are deposits for" preference**, direct feedback:
  "when depositing it should ask investor if he wants to fund his wallet
  or he wants to purchase the vehicle straight away." A new toggle on
  `/investor/wallet` (wallet top-up, or toward a specific vehicle type),
  snapshotted onto every deposit as it lands. Choosing "toward a vehicle"
  doesn't create anything by itself, it flags the deposit with a "Wants a
  {vehicle type}" badge on staff's existing `/admin/wallet/funding`
  screen so they can act on it quickly through the funding flow that
  already exists.
- **`keke-mobile` gets both features too**: five new mobile API routes,
  and two new screens, `bank-account.tsx` (current account, a
  pending/declined request banner, and a request-change form, with a
  hand-rolled searchable bank picker, no new dependency added) and
  `deposits.tsx` (deposit account, wallet balance, and the same
  wallet-top-up-vs-vehicle-purchase choice). Reached from a new "Bank
  account" row in the Profile tab (investor accounts only) and a new
  link on the Wallet tab.

## Previously delivered (Module 40: the Module 39 features brought to the web app, and a mobile header fix)

"Also find a place to add them to the web app that will not look out of
place," after seeing Module 39's mobile-only Payment History and Phone
number screens. Both already had a natural home on the web app rather
than needing a new page: `/investor/payments` (already existed, already
unfiltered) got the filter UI, `/investor/settings` (already existed,
already had two-factor authentication, named `/investor/security` at
the time, renamed in round eleven) got a "Phone number" card.

- **`/investor/payments` gets a filter bar**: five preset range chips
  (all time, this month, last 3/6 months, this year) plus a real
  browser-native `<input type="date">` range, both plain GET
  navigation, no client component, matching the exact pattern
  `app/admin/reports/page.tsx` already uses for its own from/to filter
  (see `ReportsTabs`' own comment on why: a real navigation the browser
  back button understands, not a client component pretending to be
  one). A native date input already is a real calendar picker in every
  browser, unlike React Native, so this needed no hand-rolled month
  stepper the way `keke-mobile`'s equivalent screen does. Calls
  `getInvestorPaymentHistory`'s new `filters` argument (Module 39)
  directly, no new backend route needed, this is a Server Component.
- **`/investor/settings` gets a "Phone number" card**, above the
  existing two-factor authentication card, plus a "Password" card that
  just links out to `/change-password` (already existed, already
  reachable from AppShell's account area, not duplicated here). The new
  card calls a new `updateOwnPhone` Server Action
  (`lib/actions/auth.ts`), the web counterpart to
  `POST /api/v1/auth/update-phone` (Module 39): mirrors it field for
  field rather than sharing an implementation, the same reasoning
  `changePassword` already has both a Server Action for this app's own
  pages and a separate API route for `keke-mobile`, which has no Server
  Actions to call. Same rule as everywhere else this shipped: no edit
  affordance for email anywhere near this.
- **A mobile visual fix**: the Security and Payment History screens'
  headers used the same bordered white-circle style for both the real
  back button AND an invisible layout spacer on the opposite side (kept
  only to center the title via `justifyContent: 'space-between'`).
  Reported as "i don't know what that mark is doing there" from a
  screenshot: an unlabeled circle that looks exactly like a button but
  does nothing is a legitimate thing to notice. It's a plain,
  unstyled `headerSpacer` view now, invisible as it was always meant to
  be. A second, separate mark was visible in that same screenshot, a
  gray circle with a gear icon overlapping the header. That one is not
  part of this app's code at all, confirmed by searching
  `keke-mobile/src` for anything resembling a floating button or gear
  icon, nothing renders one. Most likely either the phone's own
  system-level floating shortcut ("Quick ball" or similar, a feature
  several Android skins ship with) or a screen-recording/annotation
  tool's own on-screen control active when the screenshot was taken,
  not something this codebase can fix.

## Previously delivered (Module 39: a filterable Payment History screen, a self-service phone number update, and confirming the car/bike icons and payout chart data)

More feedback after trying Module 38 on a real phone: a way to see
payment history beyond the capped previews on Home and Wallet, a
settings affordance to change a phone number (but deliberately not
email), and two points that turned out to already be correct once
checked against the running code, covered at the end of this entry.

- **`GET /api/v1/investor/payments`**
  (`app/api/v1/investor/payments/route.ts`), a new route wrapping
  `getInvestorPaymentHistory` (`lib/data/investor.ts`, already used by
  `/investor/payments` on the web, nothing held back there either),
  now accepting optional `from`/`to` query params to narrow the result
  to a date range. `getInvestorPaymentHistory` computes the full,
  correctly-numbered entry list first (each entry's `week` is its
  position within its own contract's full schedule, which only comes
  out right against the FULL list) and filters by date range afterward,
  not as part of the Prisma query, see the function's own comment for
  why filtering the query itself would have silently renumbered weeks.
  `/investor/payments` keeps calling it with no filters, unaffected.
- **`POST /api/v1/auth/update-phone`**
  (`app/api/v1/auth/update-phone/route.ts`), lets a signed-in user
  update their own phone number: "under the settings user should be
  able to update phone number but not email address," the project
  owner's own words. A plain `prisma.user.update`, no Supabase Admin
  API call needed, unlike change-password, since phone is just a
  column on `User`, not a Supabase Auth identifier. Email stays
  deliberately out of reach on this route and everywhere in
  `keke-mobile`'s Security screen: it doubles as the Supabase Auth
  sign-in identity, changing it needs the service-role client plus a
  confirmation step and is an admin-only capability today
  (`updateInvestor`, `lib/actions/investors.ts`). Sends an email-only
  "your phone number was changed" alert, not SMS: the point of that
  alert is to reach someone if the change wasn't theirs, and SMS would
  go to the number that just changed, exactly the case that alert
  needs to cover.
- **`keke-mobile`**: a new Payment History screen (preset ranges plus a
  month stepper, reached from Home and Wallet), a "Phone number" card
  on the Security screen, and two things confirmed rather than changed,
  see `keke-mobile/README.md`'s own changelog for the detail on both:
  the Fleet/Home vehicle icon already was type-specific (a car gets a
  car sketch, a bike a bike sketch, neither branded as the keke mark),
  and the payout chart's numbers already come from the exact same
  `payoutTrend` data and query the web dashboard's own chart uses,
  Module 38 only changed how it's drawn, never what it's fed.

## Previously delivered (Module 38: mobile vehicle icons, a real recent/upcoming payment split, and a Security screen with password change and MFA)

Direct follow-up to feedback after trying Module 37 on a real phone: the
investor's own vehicle no longer shows an icon-less card, "recent
payments" was actually a flat list with upcoming entries mixed in
wherever their due date sorted, and there was nowhere on the mobile app
to change a password or turn on two-factor authentication. All four
points below came from that one piece of feedback.

- **`getInvestorDashboardData` (`lib/data/investor.ts`) now returns
  `recentPayments` and `upcomingPayments` as two separate arrays**,
  instead of one flat, date-sorted `recentPayments` list that happened
  to also contain not-yet-due entries. Both are derived from the same
  new `allEntries` flat map (computed once, filtered and sorted twice):
  `recentPayments` keeps only `PAID`/`DEFERRED` entries, most recent
  first; `upcomingPayments` keeps only `UPCOMING` entries (which itself
  collapses the schedule's `UPCOMING`/`DUE`/`PARTIALLY_PAID` states, see
  `mapScheduleStatus`), soonest due first. A card titled "Recent
  payments" now only ever shows things that already happened, matching
  what that title says.
- **`POST /api/v1/auth/change-password`**
  (`app/api/v1/auth/change-password/route.ts`), a new route mirroring
  the web app's own `changePassword` Server Action
  (`lib/actions/auth.ts`) field for field: verifies the current
  password by attempting a sign-in with it, requires the new password
  differ from the current one and be at least 8 characters, updates it
  via the service-role client (`auth.admin.updateUserById`, the same
  reason the web action needs the service-role key: this can't be done
  client-side with the anon key), clears `mustChangePassword`, and
  sends the same "your password was changed" notification the web
  action does. Needed because the mobile app has no Server Actions to
  call; two-factor authentication needed no equivalent new route, see
  `keke-mobile`'s notes below for why.
- **`keke-mobile`**: vehicle-type icons restored on the Fleet and Home
  vehicle cards, the Home/Wallet payment sections now correctly split
  into "Upcoming payments" and "Recent payments" using the data above,
  a new Security screen under the Profile tab handles password change
  and two-factor authentication, and the Home dashboard's payout chart
  was rebuilt as an animated line-and-gradient-area chart to match the
  web dashboard's own chart instead of a plain bar sparkline. Full
  detail in `keke-mobile/README.md`'s own changelog.

## Previously delivered (Module 37: the mobile app's first real dashboard, a password reveal toggle, and app-wide animation)

Follow-up on Module 36, once sign-in actually worked on a real phone: the
investor portal's Home, Fleet, and Wallet tabs go from "coming soon"
placeholders to real data, the sign-in screen gets a password
show/hide toggle, and the whole mobile app gets entrance and
press animations. Both halves of this module live in their own
projects: the new API route in this repo, everything else in
`keke-mobile`.

- **`GET /api/v1/investor/summary`, this repo's first `/api/v1` route
  that returns anything beyond "who is this."** (`app/api/v1/investor/summary/route.ts`.)
  Reuses `getInvestorDashboardData` (`lib/data/investor.ts`), the exact
  same function `app/investor/dashboard/page.tsx` already calls, so
  this is not a second copy of the investor dashboard's business
  logic, only a thin route that authenticates, checks the account has
  an investor profile, and returns the same shape as JSON. Investor
  only for now, the mobile app's other portals (staff, agent, driver)
  still have no equivalent, tracked below.
- **`getInvestorDashboardData`'s vehicle query extended** with a few
  fields the web dashboard doesn't need but the mobile Fleet screen
  does: `plateNumber`, `frameNumber`, `startDate`, and the vehicle's
  current driver's name and assignment date (via `currentDriver` and
  `driverAssignments` filtered to `endedAt: null`). The web dashboard
  card is unaffected, it just doesn't render these fields.
- **`keke-mobile`'s Home, Fleet, and Wallet tabs now show real
  investor data**, calling the new route: Home gets stat tiles (total
  invested/realized, outstanding, active investments), a wallet
  balance card, an animated payout-trend sparkline standing in for the
  web dashboard's full area chart, a first-vehicle summary card, and a
  recent-payments recap; Fleet lists every vehicle with its contract
  progress bar, plate/frame/start-date spec band, and driver card;
  Wallet shows the wallet balance and the full recent-payments list.
  Empty states (`no investments yet`, `no payments recorded yet`) and
  a retry-on-failure state match the web dashboard's own copy.
  Non-investor accounts keep seeing the Module 36 placeholders, since
  only the investor portal has a backing endpoint so far.
- **A password show/hide toggle on the sign-in screen's password
  field**, matching the project owner's request to be able to confirm
  what was typed before signing in. New `EyeIcon`/`EyeOffIcon` in
  `keke-mobile/src/components/icons.tsx`, a `showPassword` toggle
  wired to the field's `secureTextEntry`.
- **Entrance and press animations across the mobile app**, using
  `react-native-reanimated` (already part of the Expo scaffold, no new
  dependency): the sign-in screen's hero and form fields fade/slide in
  staggered on mount, the Home/Fleet/Wallet cards do the same, contract
  progress bars animate their fill from zero instead of snapping to
  their final width (`AnimatedProgressBar`), and buttons/cards spring
  down slightly on press instead of the earlier plain opacity change
  (`AnimatedPressable`). One `eslint-disable-next-line
  react-hooks/immutability` pair was needed in `AnimatedPressable`,
  see the comment there: the React Compiler lint rule bundled in
  `eslint-config-expo` doesn't yet recognize Reanimated's
  `sharedValue.value = ...` mutation pattern and flags it like ordinary
  React state.
- **A real bug fixed, found only by testing on a physical phone**:
  `proxy.ts` (this app's middleware) redirected every unauthenticated-
  looking request to `/sign-in`, including `/api/v1/*` ones, since it
  only ever checked for a Supabase cookie session, the same check a
  page navigation needs. The mobile app never sends cookies, only a
  bearer token, which the Route Handlers themselves already check via
  `authenticateApiRequest`, so every `/api/v1` call from the phone was
  silently redirected to the sign-in page's HTML instead of reaching
  its route at all. Worse, that redirect still resolved with a 200,
  so `apiFetch` (`keke-mobile/src/lib/api.ts`) never threw, the call
  just quietly returned nothing useful, and the investor dashboard
  looked empty rather than erroring. Fixed by exempting all of `/api/`
  from `proxy.ts`'s cookie check, those routes authenticate themselves.
  Not caught by ESLint, `tsc`, or vitest, none of them exercise this
  file against a real bearer-token request the way the phone does.

## Previously delivered (Module 36: the mobile app, actually scaffolded, with real sign-in)

Follow-up on Module 35's mobile guidance: three screens (sign-in,
investor home, vehicle detail) were designed and approved first, then
the real Expo project got scaffolded, not just planned this time.
Nothing in this repository changed, this module lives almost entirely
in the new sibling project, `keke-mobile`, under the same connected
folder as this one.

- **Three mobile screens designed and approved before any code.**
  Built as a Claude Design canvas (sign in, investor home/dashboard,
  vehicle detail), matching this app's design tokens exactly (colors,
  radii, shadows, the Plus Jakarta Sans type ramp, the `KekeIcon` mark)
  pulled straight from `app/globals.css` and
  `components/design-system/keke-icon.tsx` rather than guessed, plus
  the project owner's own vehicle photos for the fleet screens. Signed
  off before any real app code was written, per the project owner's
  own request.
- **`keke-mobile` scaffolded as a sibling project, not nested in this
  one.** Expo (managed React Native, TypeScript, `expo-router` file
  based routing), created with `create-expo-app`, its own
  `package.json`, its own dependency tree. No code is shared with this
  Next.js app, React Native can't run Server Components or Server
  Actions, only the backend is shared: the same Supabase project, and
  this app's `/api/v1/*` routes (see Module 35 above).
- **Real sign-in, not a mockup.** Email and password sign-in against
  the exact same Supabase project this app uses, session persisted on
  the phone via a small custom `expo-file-system` storage adapter
  (`keke-mobile/src/lib/file-storage.ts`), not `expo-secure-store`
  (a full Supabase session is bigger than SecureStore's 2KB per-value
  limit on some platforms) and not `@react-native-async-storage/async-storage`
  despite it being the package Supabase's own docs point to, its
  native module doesn't resolve in Expo Go on Expo SDK 57's bridgeless
  runtime ("AsyncStorageError: Native module is null"), even pinned to
  the exact version Expo Go SDK 57 bundles. Found the hard way testing
  on a real phone, not caught by any of this repo's own checks, since
  it only breaks inside Expo Go's native runtime, not `tsc` or ESLint.
  After signing in, the app calls `GET /api/v1/me` (Module 35) to learn
  which portal
  the account belongs to and shows the signed-in user's real name,
  email, phone, and portal on a working Profile tab, with a working
  sign-out.
- **Deliberately not reintroducing the Module 34 magic-link gap.** The
  sign-in screen shows a "send a login link by email" button, matching
  the approved design, but it doesn't call Supabase's magic-link sign
  in yet. `checkMagicLinkBlocked` (Module 34, `lib/actions/auth.ts`),
  which stops a magic link from bypassing an account's authenticator
  app requirement, only exists as a Server Action right now, not
  something the mobile app can call. Wiring the button up for real
  needs that check exposed as an `/api/v1` route first, tracked as a
  known gap below rather than shipped without the guard.
- **Fleet and Wallet tabs are honest placeholders**, "coming soon"
  screens in the app's own visual language, not fake data. Neither has
  a backing endpoint yet, only `GET /api/v1/me` exists (Module 35).
- **A real (if programmatically generated) app icon and splash
  screen**, the `KekeIcon` tricycle mark on the brand's charcoal
  background, generated from the same SVG path data as the web app's
  icon component rather than left as Expo's default logo.
- **Still not done, on purpose:** no EAS project, no Apple
  Developer/Google Play accounts, no store submission, this gets the
  app running in Expo Go on the project owner's own phone for now, see
  `keke-mobile/README.md`'s "Before you can actually publish this"
  section for the concrete remaining steps.

## Previously delivered (Module 35: a welcome message on every new account, SMS parity for security alerts, and the first real app/api route)

Follow-up on Module 34's email audit: a welcome message was missing
from every account-creation path (the audit had only confirmed one
was never built, not that one should be), and a question of whether
SMS should mirror email more broadly, both closed here. Also the true
start of two much bigger threads from the same conversation: a real
`app/api` surface for something outside this Next.js app (first and
foremost the mobile app) to call, and guidance on how the mobile
project itself gets scaffolded, both a first concrete step rather than
either being finished in one pass.

- **A welcome message on every account, all four creation paths.**
  `signUpInvestor` (self-serve, `lib/actions/auth.ts`), `createInvestor`,
  `createDriver`, and `createStaffOrAgentAccount` (all staff-created,
  `lib/actions/investors.ts`/`drivers.ts`/`staff.ts`) each now send a
  `account_created` notification (EMAIL + SMS) the moment the account
  exists. Self-serve investors get a plain "welcome, your account is
  ready", since they picked their own password and are signed straight
  in by the sign up page itself. Staff-created accounts (investor,
  driver, staff, agent) get "an account has been created for you,
  whoever set this up will share your sign-in details shortly",
  deliberately without the generated temporary password itself, that
  stays exactly where it already was, shown once on the creation
  success screen for staff to relay by hand, an email or text carrying
  a plaintext password would be a real step backward from that.
- **SMS parity for the password-changed alert.** Added EMAIL-only in
  Module 34, now EMAIL + SMS, the same channel pairing every other
  account-security notification in this app already uses (KYC status,
  withdrawal decisions), and arguably the alert most worth getting on
  a phone fast. `contract_target_achieved` stays EMAIL-only on
  purpose, that one is an internal staff ops notice, not a user-facing
  security alert, not touched here.
- **The first real `app/api/v1` route.** New `lib/api/auth.ts`:
  `authenticateApiRequest(request)` resolves a Supabase access token
  sent as `Authorization: Bearer <token>` to this app's own `User` row,
  profile, and permission set, the same shape `getCurrentUser()`
  already returns for the web app's cookie-based session, so route
  handlers can call the exact same `lib/data`/`lib/rbac` functions
  every page already calls, no business logic gets rewritten for
  mobile. Kept separate from `getCurrentUser()` itself rather than
  merged into it, that one is wrapped in React's `cache()` and reads
  `next/headers` cookies, neither of which fits a bearer token read
  from a plain `Request`. First real endpoint: `GET /api/v1/me`
  (`app/api/v1/me/route.ts`), returns which portal the signed-in
  account belongs to (investor, agent, driver, or staff, the same
  priority order `resolveStaffPortalDestination` already uses for the
  web sign-in page), `mustChangePassword`, and the permission list, a
  mobile client's very first "am I still signed in, which home screen
  do I show" call. This is a foundation and one endpoint, not a
  finished API, every future mobile screen needs its own route built
  the same way as its web page gets identified.
- **Mobile scaffolding: guidance given, not yet started.** Recommended
  Expo (managed React Native, TypeScript template) as its own project,
  a sibling folder next to `keke-platform` under the same connected
  root rather than inside it, talking to the exact same Supabase
  project (same URL and anon key, exposed to Expo as `EXPO_PUBLIC_*`
  variables) and the new `/api/v1` routes above for anything that
  isn't a direct Supabase read. Full reasoning and steps given in
  chat, actual scaffolding (`npx create-expo-app`, a real install on
  the project owner's own machine) intentionally not run yet pending
  confirmation, see the conversation itself for the full guide.

## Previously delivered (Module 34: closing the magic-link 2FA gap, a password-change alert, an email audit, and a card-layout/click-feedback pass)

Three separate asks after Module 33 shipped: whether every email this
app is supposed to send is actually intact, plus a recommendation on
the still-open magic-link 2FA gap; a UI pass making single-column
detail/settings pages fill the screen and giving clickable things real
press feedback, `/admin/settings/contract-terms` named directly as the
example; and what's actually left before Android/iOS work starts.

- **Email audit, all fully wired, one real gap found and closed.**
  Every app-originated email goes through one funnel,
  `sendNotification()` (`lib/notifications/send-notification.ts`) over
  Resend. Nine distinct types exist today, all genuinely triggered
  (KYC decisions, a bank payout, a wallet credit, a contract hitting
  its target, a remittance landing in an agent/driver's collection
  account, a wallet withdrawal approved or rejected, a wallet-funded
  vehicle, an ownership transfer completing), none stubbed or
  commented out. Two of the four named specifically, an account
  confirmation email and an email-verification email, genuinely do
  not exist, by design: every account this app creates
  (`supabaseAdmin.auth.admin.createUser`) is created with
  `email_confirm: true`, pre-confirmed by whoever created it (staff,
  or the investor themselves at signup), so there is nothing to
  confirm by email in the first place. Password reset and the
  magic-link sign-in email are sent by Supabase's own outgoing-email
  system directly, not through Resend, already documented as such.
  The one real gap: changing a password
  (`changePassword`, `lib/actions/auth.ts`) never told the account
  holder it happened, so a password changed by someone other than the
  account holder (a shared device, a session that got the password
  reset before this app's own MFA gate ever saw it) went out with no
  alert at all. Fixed: `changePassword` now sends a
  `password_changed` email through the same funnel every other alert
  uses, the moment the password update itself succeeds.
- **The magic-link 2FA gap (open since Module 30) closed.** The
  two-factor challenge on `/sign-in` only ever covered the password
  path, "send a login link by email" signed the browser straight in
  with no code prompt, even for an account with two-factor turned on.
  Module 30 named two ways to close it: disable magic-link for any
  account with MFA on, or add the same AAL check after the redirect.
  Built the first, recommended over the second because this app has
  never had an `/auth/callback` route for the magic link to land on
  and be checked after the fact, building one is a real new redirect
  flow with more to get wrong, while blocking before the link is even
  sent is a single lookup with no new route. New
  `checkMagicLinkBlocked` (`lib/actions/auth.ts`) resolves the email
  to this app's own `User.authId`, asks
  `supabaseAdmin.auth.admin.getUserById` for that account's MFA
  factors, and if a verified one exists, `app/sign-in/page.tsx`'s
  `handleMagicLink` shows an error and never calls
  `signInWithOtp` at all. An email with no matching account, or an
  admin API lookup failure, is deliberately not blocked, this check
  only ever adds a restriction, never a false one that would take
  down magic-link sign-in for every account over an unrelated Supabase
  hiccup.
- **Every clickable thing now feels clicked the instant it's pressed.**
  The explicit complaint: a card or button that "should feel like it
  has been clicked... rather than sitting down and doing nothing,"
  `/admin/settings/contract-terms`'s Save button named as the example.
  Turns out nothing in this app was actually missing a *pending*
  state, `Button`'s existing `loading` prop and `SubmitButton`'s
  `useFormStatus()` wrapper already cover every submit action, see
  Module 25/28's own work on this. The real gap is the moment before
  that: a Server Action has to leave the browser and come back before
  React even learns to show `pending`, so a click still felt like
  nothing happened for that first beat. Fixed once, app-wide, in
  `components/ui/button.tsx`: `active:scale-[0.97]` is a pure CSS
  pseudo-class, it fires the instant a mouse or tap goes down, no
  JavaScript involved, closing that gap for every `Button` and
  `SubmitButton` in the app, including a `Button asChild` wrapping a
  `Link`. (The transition list is spelled out explicitly,
  `transition-[color,background-color,border-color,box-shadow,transform]`,
  rather than stacking a second `transition-*` utility next to the
  existing one, two of those utilities both set the same underlying
  CSS property and the second one would have silently overridden the
  first instead of adding to it.)
- **Four single-column detail/settings pages, the ones most likely to
  actually be noticed, turned into the same two-column layout the
  investor detail page got in Module 33.** `app/admin/drivers/[id]`,
  `app/admin/settings/staff/[id]`, and `app/investor/payout-details`
  all shared the identical shape, two cards each capped at
  `max-w-[560px]` and stacked with `flex flex-col gap-5`, real space
  wasted on any screen wider than that. All three now use
  `grid grid-cols-1 gap-5 px-8 py-6 lg:grid-cols-2 lg:items-start`
  with the `max-w` caps removed, same fix, same pattern, three times.
  `/admin/settings/contract-terms` (the page named directly) needed a
  slightly different shape, its two vehicle-type cards live inside one
  `<form>` alongside a "Save all" button that has to stay full width
  below them, so only the card pair was wrapped in
  `grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start`, the form
  itself and the submit row stayed a plain column. A few more pages
  (`/admin/transfers/[id]`, `/admin/kyc/[investorId]`) were surveyed
  and deliberately left alone, their cards are a hero banner, a table,
  and action panels, not interchangeable same-shaped boxes, forcing
  them into a grid risked making the page read worse, not better.
- **Mobile (Android/iOS): what's actually next, answered in chat, not
  built.** Short version: yes, a separate project (folder or its own
  repo), a Next.js App Router codebase's Server Components and Server
  Actions don't run inside a React Native app at all. The real
  blocker isn't the mobile project itself, it's that this backend has
  almost no API surface for an external client to call yet, `app/api/`
  today holds exactly one route, the Paystack webhook, everything
  else is a Server Action reachable only from this app's own pages.
  Mobile work needs a real Route Handler API layer (or direct Supabase
  client access for the simplest reads) built first. Not started.

## Previously delivered (Module 33: four more reports, a per-partner statement with CSV/PDF export, and two UI fixes)

Requested after showing the project owner the Reports tab built in
Module 32, four asks at once: which other reports could live under
Reports, a way to open one specific agent/driver/investor's full payment
history and hand it to them as a document, why the investor bank account
form was missing entirely on one machine, and a layout complaint about
the investor detail page (all cards stacked in one narrow column,
scrolling required, half the screen empty).

- **Four new reports, each its own tab.** `/admin/reports/portfolio`,
  every open contract's progress toward its target payout and how many
  of its scheduled installments are currently overdue, worst-first.
  `/admin/reports/arrears`, every schedule entry currently overdue
  (not just due today, distinct from the dashboard's own "due today"
  card), attributed to whichever agent runs the vehicle, plus a
  by-agent summary so it's obvious whose collections are actually
  falling behind. `/admin/reports/fleet`, what each vehicle has
  actually earned the business (collections in, investor payouts and
  maintenance cost out), a company profitability view, not the
  investor's own return. `/admin/reports/kyc`, investor counts by KYC
  status platform-wide plus a worklist of who's still waiting, oldest
  first, distinct from `/admin/kyc`'s actual review queue. A new
  `components/admin/reports-tabs.tsx` tab strip ties all five Reports
  pages together (Money flow, Portfolio, Arrears, Fleet, KYC), plain
  links, not client-side tab state, same GET-navigation philosophy as
  every filter form in this app. All four gated behind the same
  `REPORTS_VIEW` permission the money-flow report already uses, no new
  permission key, no reseed needed this time.
- **Two real bugs caught and fixed while building the new reports, both
  the "before today's midnight, not before this instant" kind.**
  `getPortfolioProgressReport` and `getArrearsReport` both originally
  compared a schedule entry's `dueDate` against `new Date()`, the
  current instant, not the start of today. An entry due at today's own
  midnight would have counted as overdue the moment the clock passed
  00:00, hours before staff had the whole day to actually collect it,
  quietly disagreeing with the dashboard's own `getInvestorsDueToday`,
  which correctly treats "due today" as its own window, not overdue.
  Fixed by using the existing `startOfDay()` helper (`lib/utils.ts`,
  added in Module 32) for both. Caught by re-reading the logic against
  the dashboard's own boundary before shipping, not by a test or a
  build, exactly the kind of off-by-a-few-hours bug neither lint nor
  `next build`'s type check would ever catch, they're both fully valid
  TypeScript, just wrong.
- **A per-agent/driver/investor account statement, with CSV and PDF
  export.** Every row on the Reports "By partner" table is now a link
  (`PartnerBreakdownRow` gained `id`/`kindPath` fields to carry the
  href) to `/admin/reports/partner/[kind]/[id]`, that account's full
  payment history, all time by default, with its own optional from/to
  filter. Backed by a new `getPartnerStatement()` in `lib/data/reports.
  ts`. "Download CSV" hits a new authenticated Route Handler,
  `app/admin/reports/partner/[kind]/[id]/export/route.ts`, gated behind
  `REPORTS_VIEW` the same as the page, returning the same statement as
  a UTF-8 CSV (opens directly in Excel) with a leading byte-order mark
  so Excel doesn't mangle the currency figures, filtered by whatever
  from/to range the page currently has applied so what downloads always
  matches what's on screen. "Print / Save as PDF" is a new
  `components/admin/print-button.tsx` client component that just calls
  `window.print()`, every major browser's print dialog offers "Save as
  PDF" natively, deliberately not a new PDF-generation dependency:
  this sandbox already can't run `next build`, adding a PDF library
  neither this sandbox nor a real build has yet verified felt like the
  wrong tradeoff for what a browser already does for free. Made this
  work cleanly by adding `print:hidden` to the sidebar
  (`components/layout/app-shell.tsx`) and to the tab strip/filter form,
  so what prints (or saves as PDF) is just the statement itself, not
  the app chrome around it.
- **Investor bank account form missing entirely: a config issue, not a
  bug.** Traced to `PAYSTACK_SECRET_KEY` not being set (or not being a
  working key) in that machine's own `.env`/`.env.local`. Both
  `/admin/investors/new` and the investor edit page fetch Paystack's
  bank list before showing the bank entry form at all (a bank code has
  to be verified against Paystack before it can be saved, see Module
  30's reasoning), when that fetch fails, the form is replaced with the
  error message rather than shown in a half-working state, which reads
  as "no way to enter it" rather than "here's what to fix." No code
  change, `.env.example` already documents the variable, it just needs
  a real Paystack secret key (test or live) filled in.
- **Investor detail page layout.** `app/admin/investors/[id]/page.tsx`
  stacked all three cards (edit form, bank account, account access) in
  a single column capped at 560px wide, on any screen wider than that,
  the right half of the page sat empty and the page scrolled sooner
  than it needed to. Reworked into a two-column grid, edit form and
  account access on the left, bank account on the right, both columns
  filling the available width, no `max-w` cap needed once the grid
  itself controls the column width.
- **Confirmed working, and one real bug found from the resulting dev
  log.** The project owner set a real `PAYSTACK_SECRET_KEY` and pasted
  their own `npm run dev` log: `updateInvestorBankDetails` completed
  with a 200, so the bank account form now genuinely saves, the config
  issue above is resolved on their machine. That same log also showed
  React warning about duplicate keys on five different numeric values
  (`50572`, `100025`, `50739`, `50840`, `51253`). Traced to
  `PaystackProvider.listBanks()` (`lib/payments/paystack-provider.ts`):
  Paystack's real `/bank` list is known to repeat the same `code` across
  more than one entry (different channels or products under one bank
  sharing an NIP/CBN code), and every caller of `listBanks()` (the
  investor bank form here, `/admin/investors/new`, and the investor's
  own `/investor/payout-details`) renders that list straight into a
  `<select>` keyed on `code`, so a duplicate code meant a duplicate,
  indistinguishable `<option>` a person could pick between, not just
  console noise. Fixed once at the source, `listBanks()` now dedupes by
  `code` before returning, keeping the first entry for each code, so
  all three callers get a clean list with no code repeated.
- **Same log, a second warning, resolved: the actual browser
  "Component stack" (something the terminal log never carried) finally
  pinned it down.** "Each child in a list should have a unique key
  prop... Check the render method of `LinkComponent`", open since
  Module 28. The trace named `layout.tsx:128` and `layout.tsx:165`,
  which is `app/admin/layout.tsx`'s `navGroups` array and the closing
  brace of `AdminLayout` itself, exactly the portal sidebar's nav data.
  Root cause: `navGroups` is a plain array literal built in a Server
  Component (`AdminLayout`) and handed as a prop across the
  server/client boundary to `SidebarNav` (a Client Component), and
  each `NavItem.icon` field holds a raw JSX element (an inline `<svg>`
  or `<KekeIcon>`) sitting at an arbitrary position inside that data,
  not as an actual children list. Next's Flight serializer still has
  to ship those icon elements to the client as part of the payload,
  and on the client, React's reconciler (visibly triggered here by
  Fast Refresh, "[HMR] connected" sits right above the warning in the
  console) walks that array the same way it walks a real children
  list, so an icon element sitting at an array position with no `key`
  of its own reads as an unkeyed list child, even though nothing in
  `SidebarNav`'s own `.map()` (which already keys every rendered
  `<Link>` off `item.href`) was ever missing a key. Not unique to
  admin: every portal's `layout.tsx` (agent, driver, investor) builds
  its `navGroups` the same way, so all four carried the same latent
  issue, it had just only been exercised (and only ever logged) on the
  two admin pages the project owner happened to load. Fixed by giving
  every inline icon element in all four `layout.tsx` files its own
  explicit `key` (a slug of that item's own `label`, e.g.
  `key="fleet-icon"`), 26 icons across the four portals in total.

## Previously delivered (Module 32: a Reports tab, and money-flow cards on the dashboard)

Requested after the project owner asked whether the app could show total
outflow, general outflow per partner, to track it from the dashboard,
and whether inflow and outflow could be traced per day/date. Two
additions, both reading from one new shared data layer so they can never
disagree with each other about the same numbers:

- **`lib/data/reports.ts`, the single source of truth for every
  money-flow number in the app.** One query against
  `PaymentTransaction` for a given date range (excluding `REVERSED`,
  defined on `PaymentTransactionStatus` but never actually set by any
  code today, excluded anyway so a reversal added later can't silently
  inflate totals), then everything else, the summary totals, a
  day-by-day breakdown, and a per-agent/per-driver/per-investor
  breakdown, is derived from that one result set in JS. `agentId`,
  `driverId`, and `investorId` on `PaymentTransaction` are plain
  `String?` columns, not real Prisma relations (the same "column, not a
  relation" shape fixed twice already, Module 29's KYC crash and Module
  31's reconciliation bug), so partner names are resolved the same
  established way: collect the distinct ids actually present, run one
  follow-up `findMany` per partner type, build `id -> name` maps. The
  daily breakdown zero-fills every day in the range before summing rows
  into it, the same discipline `buildWeeklyTrend`
  (`lib/data/chart-helpers.ts`) already uses for the existing weekly
  chart, so a quiet day shows as a real gap in the trace, not a missing
  row.
- **`/admin/reports`, a new page gated behind a new `REPORTS_VIEW`
  permission.** A `from`/`to` date filter (a plain GET-navigation form,
  defaulting to the last 30 days, matching `/admin/audit-log`'s filter
  pattern, no Server Action to throw in), four summary cards (inflow,
  outflow, net, transaction count), two daily trend charts reusing the
  existing `AreaTrendChart` component, a day-by-day trace table (every
  day in the range, oldest first, so a specific date's inflow and
  outflow can be looked up directly, the explicit requirement asked
  for), and a by-partner breakdown table (agents and drivers who
  remitted money in, investors who were paid money out, sorted by total
  activity). Added to the admin nav under Operations, between Wallet/KYC
  and Audit log. `REPORTS_VIEW` was added to `PERMISSIONS`
  (`lib/rbac/permissions.ts`) and to the Finance role's default seed
  array; **this is a new permission key, so it only exists as a real,
  grantable `Permission` row once `npx prisma db seed` is re-run on the
  project owner's own machine** (idempotent, safe to re-run), same as
  every previous new-permission module.
- **Two new stat cards on `/admin/dashboard`**, added beneath the
  existing four fleet cards, not replacing them: inflow this month and
  outflow this month (net shown as a third card), the current calendar
  month so far, plus a link straight through to the full Reports tab.
  These reuse `getReportsData` under the hood (a new
  `getMonthToDateFlowSummary` helper in `lib/data/reports.ts`), so the
  dashboard's month-to-date figures and the Reports tab's numbers for
  the same period are guaranteed to match, never two separate queries
  drifting apart.

**Fixed after the fact**: running `npx prisma db seed` on the project
owner's own machine (needed for the new `reports.view` permission to
exist, see above) failed with `PrismaClientKnownRequestError: No record
was found for a query` on `prisma.permission.findUniqueOrThrow`, a real,
self-inflicted bug: `prisma/seed.ts` keeps its own hand-written
`PERMISSION_DESCRIPTIONS` map (one description string per permission
key, `Record<PermissionKey, string>`) separate from the `PERMISSIONS`
catalog itself, and `reports.view` was added to the catalog without
adding its matching entry there. `PERMISSION_DESCRIPTIONS`'s own type
should force every key to be present, but `seed.ts` runs through `tsx`,
which transpiles and executes without type-checking first, so nothing
caught the gap until a real seed run hit a real, empty-of-that-key
database. Fixed by adding the missing
`[PERMISSIONS.REPORTS_VIEW]: "..."` entry. Caught this time without
needing another round trip to the project owner's machine: `npx tsc
--noEmit` turns out to run fine in this sandbox even though `next build`
itself cannot (the blocker is specifically the build step's Google Fonts
fetch, not TypeScript itself), and it flagged this exact missing-key
error directly, `error TS2741: Property "reports.view" is missing in
type ... but required in type 'Record<PermissionKey, string>'`. Most of
what `tsc --noEmit` reports here is noise from this sandbox's own stale
generated Prisma Client (implicit-`any` parameters and missing exports
like `VehicleType`/`InvestorProfile` across many already build-verified
files, the same "Prisma CLI/engine blocked in this sandbox" limitation
"Known gaps" already documents), so it is not a substitute for a real
`next build` and its output has to be read selectively, but a
self-contained type error like this one, in a file that does not depend
on Prisma's generated types, is real and worth checking for before
asking for another reseed or build. Re-verified clean with `npm run
lint`, `npx vitest run` (80/80), and this same `npx tsc --noEmit` check
narrowed to the two touched files.

**Confirmed clean**: the project owner re-ran `npx prisma db seed` for
real (`reports.view` seeded correctly this time, Finance now shows 7
permissions), then ran a real `next build` from their own machine.
`Compiled successfully`, `Finished TypeScript`, all 55 routes listed
with no errors, `/admin/reports` among them, one more than Module 31's
54. This also confirms something suspected but not proven at the time:
the implicit-`any` and missing-export noise `npx tsc --noEmit` reported
against `lib/data/reports.ts` in this sandbox really was this sandbox's
own stale generated Prisma Client, not a real problem, a real build with
a real client compiled that file clean.

## Previously delivered (Module 31: three real build-breaking bugs, finally caught by a real `next build`)

Asked how to run a real `next build` locally to check for errors this
sandbox can't catch (see "Known gaps," this project has only ever been
checked with `npm run lint` here), the project owner did exactly that,
and it worked: `next build` compiled successfully, then failed its type
check with eight errors across three files. All three were genuine bugs,
not build-tooling noise, none of the eight were false positives.

- **`app/kyc/page.tsx`, a type mismatch, not a runtime bug.**
  `getMyKycDocuments` (`lib/data/kyc.ts`) built its return value with the
  type annotation `Record<string, DocumentInfo | null>`, a loose,
  open-ended shape, while `IdentityForm`'s `documents` prop wants exactly
  `{ GOVERNMENT_ID: DocumentInfo; PROOF_OF_ADDRESS: DocumentInfo }`. The
  object only ever actually has those two keys at runtime, `KycDocumentType`
  (`prisma/schema.prisma`) only has two values, but TypeScript can't know
  that from a `Record<string, ...>` annotation, a plain string-indexed
  record could in principle have any other key too, so it isn't assignable
  to the specific two-key type. This one would never have crashed
  anything, `npm run dev` and `npm run lint` both let it through, it only
  surfaces under a real build's stricter type check. Fixed by narrowing
  the annotation to `Record<"GOVERNMENT_ID" | "PROOF_OF_ADDRESS", ...>`,
  matching what `IdentityForm` actually expects.
- **`lib/data/investor.ts`, comparing a Prisma `Decimal` with `>` directly,
  in two places.** `entry.amountPaid > 0 ? entry.amountPaid :
  entry.expectedAmount`, both sides of the ternary being Prisma `Decimal`
  values (backed by `decimal.js`), which doesn't overload the `>`
  operator against a plain number the way TypeScript otherwise expects.
  Same instance duplicated in `getInvestorDashboardData` and
  `getInvestorPaymentHistory`. Fixed by converting to `Number(...)`
  before comparing, not after, matching the pattern already used
  everywhere else money is compared in this codebase.
- **`lib/data/reconciliation.ts`, a real bug, the same shape as Module
  29's KYC crash, just never actually hit in practice.**
  `getRecentlyProcessedTransactions` tried to
  `include: { agent: {...}, driver: {...} }` on a fetched
  `paymentTransaction`, as if `PaymentTransaction.agentId`/`.driverId`
  were real Prisma relations. They never were, both are plain `String?`
  columns, unlike `providerTransaction`, `batchItem`, and `allocations`
  on that same model, which are real relations. Exactly the
  "column, not a relation" shape `KycDocument.reviewedById` turned out to
  be in Module 29, just never actually exercised for real this time
  (`/admin/payments/reconciliation`'s "Recently processed" list needs a
  `PROCESSED` `charge.success` transaction with a linked
  `PaymentTransaction` to even reach this code path), so it sat there
  undetected instead of crashing. Fixed the same way Module 29 was fixed:
  two follow-up lookup queries (`prisma.agent.findMany`,
  `prisma.driver.findMany`) instead of an invalid `include`, no schema
  change or migration needed.
- **A ninth error, a real fix causing a real follow-on break, caught by
  running `next build` a second time after the first eight were fixed.**
  Narrowing `getMyKycDocuments`'s return type (the fix above) from a
  loose `Record<string, ...>` to the exact two-key type `IdentityForm`
  wants fixed `app/kyc/page.tsx`, but broke type-checking in the one
  other place that reads the same function's result:
  `app/investor/documents/page.tsx` indexed into it with `(typeof
  documents)[string]`, which no longer has a matching index signature
  now that the type is the narrower, exact one. Fixed by indexing with
  `(typeof documents)[keyof typeof documents]` instead, which resolves
  to the same two literal keys regardless of how loose or narrow the
  source type is, so it can't break again the same way if this type
  changes shape a third time. Grepped for every other place that calls
  `getMyKycDocuments`, only these two exist, nothing else was left
  exposed to the same fallout.

This is exactly the payoff "Known gaps" already predicted, running a real
build catches a category of bug lint and dev mode both miss entirely.
Worth doing again after any future batch of changes, not just this once,
and worth running a second time after fixing what the first run found,
exactly as this ninth error demonstrates.

**Confirmed clean**: a third `next build` run, after the ninth error's
fix, came back fully green, `Compiled successfully`, `Finished
TypeScript`, and all 54 routes listed with no errors, `○` for the handful
that are genuinely static (`/`, `/sign-in`, `/sign-up`, `/setup`,
`/forgot-password`, `/reset-password`, `/_not-found`) and `ƒ` for every
page that needs a signed-in user or a database read, which is correctly
almost everything else in this app. This is the first time this whole
project has had a real, complete, passing production build confirmed
against a real database, not just `npm run lint` from inside a sandbox
that can't run one at all.

## Previously delivered (Module 30: staff-managed password resets, optional two-factor authentication, and a Paystack setup clarification)

Three requests together this time: no way for an admin or assigned staff
member to reset a locked-out investor, agent, driver, or staff member's
password; no two-factor authentication anywhere on the platform at all;
and confusion over what the bank account card on an investor's page was
actually telling them.

- **Password reset, from the account's own edit page.** Admins and any
  staff member with the matching manage permission
  (`INVESTORS_MANAGE`, `FLEET_MANAGE`, or `STAFF_MANAGE`) can now
  generate a brand new temporary password for an investor, driver, staff
  member, or agent, right from that account's edit page, under a new
  "Account access" card. It mirrors account creation's own generated
  password flow exactly: a random temporary password is set on their
  Supabase Auth account (`supabaseAdmin.auth.admin.updateUserById`), their
  `mustChangePassword` flag is set so they are forced to choose their own
  password the next time they sign in, and the generated password is
  shown once, in a "copy this now, it will not be shown again" banner,
  the same way a newly created account's password is shown once today.
  Every reset is written to the audit log
  (`investor.password_reset`, `driver.password_reset`,
  `user.password_reset`). A driver with no app account at all (an older
  driver record predating Module 22's every-driver-gets-an-account
  change) simply has no "Account access" card to click, there is no
  password to reset. To be direct about a real limitation: resetting a
  password does **not** sign the account out of any device it is
  currently signed in on, Supabase does not offer a "revoke all sessions"
  call through the same admin API used here, that is called out in the
  panel's own copy rather than silently implied, and is noted below under
  Known gaps.
- **Two-factor authentication, optional, for every account type.** A new
  "Security" page (`/investor/settings`, `/agent/settings`,
  `/driver/settings`, and `/admin/settings/security` for staff and the
  Admin account; the first three were named `/investor/security`,
  `/agent/security`, and `/driver/security` at the time, renamed to
  "Settings" pages in round eleven) lets anyone turn on an
  authenticator app (Google Authenticator, Authy, or similar) as a
  second sign-in step: scan a QR
  code, confirm with the 6-digit code it shows, done. Built entirely on
  Supabase Auth's own MFA support (`supabase.auth.mfa.*`), nothing new in
  `prisma/schema.prisma`, no migration, Supabase tracks enrolled factors
  itself. Scoped deliberately narrow for a first pass, matching what was
  asked for: authenticator apps only (no SMS-based codes), and optional
  for everyone rather than required of anyone, so nobody already using
  the platform is locked out by a feature landing under them. Once
  turned on, both password sign-in pages (`/sign-in` and
  `/admin-sign-in`, the shared portal one and the separate Admin one)
  challenge for the 6-digit code right after the password succeeds,
  before the existing Admin-detection and portal-routing logic runs, an
  enrolled factor that is never actually challenged would just be
  theater. A shared `MfaSettings` component
  (`components/account/mfa-settings.tsx`) is what every one of the four
  Security pages renders, so the enroll, confirm, and turn-off flow only
  exists in one place. Known gap, disclosed rather than left for someone
  to discover the hard way: the "send a login link by email" magic-link
  option on `/sign-in` does **not** currently challenge for a second
  factor, only the password path does, called out below under Known
  gaps too.
- **The bank account card was correct, not broken.** What was pasted
  ("No payout account on file yet..." plus "PAYSTACK_SECRET_KEY is not
  set") is the card working exactly as designed, not a bug: the first
  line is the expected message for any investor who has not had bank
  details entered yet (see Module 28/29 above for where that happens),
  and the second is `lib/payments/paystack-client.ts` correctly refusing
  to attempt a Paystack bank-account lookup because the
  `PAYSTACK_SECRET_KEY` environment variable genuinely is not set on
  this machine yet. That variable needs a real Paystack secret key
  (test or live) in the local `.env` file before bank account entry, or
  any other Paystack-backed feature (remittances, payouts, wallet
  funding), can work, see "Running this locally" further down for where
  that and the app's other environment variables are documented.
- **A real bug found while explaining the above: the bank name was never
  actually shown, only its Paystack code.** A follow-up question ("I saw
  one investor with an account, but no bank name, just a number") pointed
  at something genuinely wrong, not confusion: the "Bank account" card on
  both `/admin/investors/[id]` and the investor's own
  `/investor/payout-details` displayed `{accountNumber} · {bankCode}`,
  the raw Paystack bank code (`"058"`, `"044"`) sits right next to the
  account number and reads exactly like a second account number, not a
  bank name at all, next to nothing to suggest it means "Guaranty Trust
  Bank" or "Access Bank." This app never stored a separate human-readable
  bank name column, only the code Paystack's own API deals in, plus the
  account **holder's** name (`bankAccountName`, e.g. "Aisha Oyelaran"),
  which is a different field and was already displaying correctly. Fixed
  without a schema change: both pages already fetch the full bank list
  from Paystack (`provider.listBanks()`) to populate the "Select a bank"
  dropdown in the entry form, that same list is now also used to look the
  saved `bankCode` back up to its name for display. The admin page
  previously only fetched that list for staff holding `INVESTORS_MANAGE`,
  now it also fetches it for `INVESTORS_VIEW`-only staff, purely so the
  name resolves for them too, not just for the ones who can edit it. To
  restate the bigger point this was raised alongside, directly: no,
  investor bank accounts are not generated by Paystack, only agent and
  driver collection accounts are (real Paystack Dedicated Virtual
  Accounts, money flows in). An investor's real-world bank account, the
  one a bank statement would actually show, only ever gets into this
  system because an admin or assigned staff member typed it in, on either
  of the two pages above, choosing the bank from a dropdown and entering
  the 10-digit account number; Paystack is used only to verify that
  account is real (resolving it to an account holder name) before saving
  it, the same "confirm before trusting" check Module 28 already
  described, never to invent or auto-populate one. That resolved account
  is what `createPaymentBatch` (`lib/actions/payments.ts`) later pays a
  weekly, or however-often-agreed, payout to, through a Paystack Transfer,
  not a Dedicated Virtual Account.
- **A fair follow-up question, and a real answer: what does that Paystack
  check actually confirm?** `/bank/resolve`, the endpoint
  `resolveBankAccount` calls, takes only an account number and a bank
  code, nothing else, no name to compare against, because this app never
  had a name to send it in the first place. What it checks is narrower
  than it might sound: that the account number is real and currently open
  at that bank, and it hands back whoever's name the bank has on file for
  it. It does **not** check that name against anything, because there is
  nothing here to check it against, an investor never types their own
  name into this form, only the bank and account number, the name shown
  afterward is entirely what Paystack returned. Concretely: enter a real,
  open account number at the right bank and it resolves, whoever the name
  on it turns out to be, this app has no way today to flag "this account
  doesn't belong to this investor" versus a shared or third-party account
  (a spouse's account, for instance) being used on purpose, that
  distinction would need comparing the returned name against
  `InvestorProfile.user.fullName` and deciding what to do about a
  mismatch (block it outright, or just warn and let staff decide), not
  built, not asked for yet.
- **The real gap the question underneath was pointing at: bank details
  had no place at onboarding itself, only after.** Fair to call out
  directly rather than explained away again: bank account entry has
  existed since Module 28, but only on the investor's edit page,
  `/admin/investors/[id]`, reached after the account already exists.
  `/admin/investors/new`, the actual "Add investor" form, never had a
  bank section at all, full name, email, phone, and the wallet-vs-bank
  payout preference, nothing about the account itself. Not a bug hiding
  somewhere, this was simply never built into the creation form, only
  added afterward as an edit-time feature, which is exactly why it kept
  reading as "still not fixed" no matter how many times the edit page was
  explained. Fixed now: "Add investor" has its own optional "Bank account"
  section, same bank dropdown and account-number field as the edit page,
  resolved against Paystack (`resolveBankAccount`) before the Supabase
  Auth account is even created, so a bad account number is caught before
  anything is created at all, not left as a real sign-in account with a
  bank problem to sort out afterward. Left optional on purpose: filling
  in nothing at all still works exactly as before (create the investor,
  add the bank later from their edit page), for whenever staff doesn't
  have the details in hand yet at signup, or `PAYSTACK_SECRET_KEY` isn't
  configured on this machine at all, in which case the section shows the
  same "Add a working `PAYSTACK_SECRET_KEY`" message the edit page does
  rather than a broken, empty dropdown.

## Previously delivered (Module 29: a real KYC review crash fixed, and investor bank details made easier to find)

Feedback on Module 28 itself, three things: a genuine crash the moment a
reviewed KYC document's detail page was opened, confusion about where the
new investor bank account entry point actually lives, and the React key
warning still showing with the same unhelpful browser trace as before.

- **A real bug fixed: `/admin/kyc/[investorId]` crashed the instant a
  document had already been reviewed.** `getInvestorKycDetail`
  (`lib/data/kyc.ts`) did `include: { reviewedBy: { include: { user:
  true } } }` on `KycDocument`, as if `reviewedBy` were a real Prisma
  relation. It never was, `KycDocument.reviewedById` has always been a
  plain `String?` column in `prisma/schema.prisma`, unlike the identical
  reviewer pattern on `WalletWithdrawal` and `OwnershipTransfer`, which
  both do have a real relation. `PrismaClientValidationError: Unknown
  field 'reviewedBy'` on every single load, this page had apparently
  never actually been opened for an already-reviewed document until now,
  the same "never exercised for real" shape as reconciliation in Module
  27. Fixed without a schema change or a migration: reviewer names are
  now looked up with a second query (`prisma.staffProfile.findMany`)
  instead of a Prisma `include`, works immediately, no `npx prisma
  migrate dev` needed. A real `@relation` could still be added later to
  match the `WalletWithdrawal`/`OwnershipTransfer` pattern properly, that
  would need a migration for the foreign key constraint, noted in Known
  gaps rather than done here.
- **Investor bank account entry made harder to miss.** The feature itself
  from Module 28 was working, on `/admin/investors/[id]`, but the
  investors list gave no visual hint any given investor was missing bank
  details, and its rows had the same "looks clickable, isn't fully
  clickable" issue fixed elsewhere in Module 28 but not carried over to
  this list. `/admin/investors` now has its own "Bank account" column
  (a Badge, "On file" or "Not set") and its rows use the same
  `ClickableRow` component now. To be direct about the question asked:
  bank details are entered on the investor's own record, not during
  onboarding and not tied to KYC status either way, an investor with KYC
  still pending can have their bank account entered or an already-verified
  one can still be missing it, the two are unrelated.
- **The React key warning: still can't pin it down.** The browser trace
  pasted this time ("at svg (`<anonymous>`:null:null)") still carries no
  file or line, a search for any `.map()` producing raw `<svg>` elements
  without a key, anywhere in the app, still found nothing (this pass
  specifically targeted that shape, since the trace's only concrete
  detail is that the unkeyed element type is `svg`). The two places that
  actually do map arrays of `<svg>` icons (`/sign-in`, `/sign-up`, the
  admin dashboard's stat cards) all already key correctly on unique
  string labels. Still the same ask as before: the "Component stack"
  section in the browser's error overlay, or expanding
  "Show 20 ignore-listed frame(s)", carries far more detail than what's
  been pasted so far, that's genuinely the fastest way to close this out
  rather than more speculative searching.

## Previously delivered (Module 28: real filters and clickable rows, an asset tag autofill, loading spinners on buttons, and admin-entered investor bank details)

Seven things reported together in one message: a React "key" console
warning, confusion about how KYC review actually works, payment batch
rows that looked pending but weren't clickable, a fleet filter bar that
did nothing, a request to auto-suggest the next asset tag, a request for
some visible feedback when a button is clicked, and no way for staff to
enter an investor's bank details.

- **The React key warning: searched exhaustively, found nothing, need
  more from the browser.** "Each child in a list should have a unique
  key prop... Check the render method of `LinkComponent`" is React's own
  dev-mode warning, `LinkComponent` is `next/link`'s internal name, not
  anything in this codebase. Every `.map()` paired with a `Link` or a
  `TableRow`, across all four portals, was checked by hand against its
  key: all were keyed off a database id or a unique static href, nothing
  duplicated or missing turned up, and a stricter explicit
  `eslint-plugin-react`'s `react/jsx-key` pass came back clean too. This
  sandbox can't boot `next dev` (no route to the binaries Prisma and Next
  need at runtime here), so the warning couldn't be reproduced live to
  watch it happen. If it's still showing, the fastest way to actually
  find it: open the error overlay in the browser, there's a collapsed
  "Show 20 ignore-listed frame(s)" line, below the visible stack there
  should also be a "Component stack" section (sometimes needs scrolling
  or expanding); that names the exact component tree the warning fired
  from, paste that here and it can be fixed directly instead of guessed
  at.
- **KYC review and payment batch approval both already worked, they just
  didn't look clickable.** `/admin/kyc/[investorId]` already has real
  Approve/Reject buttons per document and an overall Verify/Reject
  decision, `/admin/payments/batches/[id]` already has real Approve &
  Pay/Reject buttons, neither was actually broken. What was broken: the
  list rows on `/admin/kyc`, `/admin/payments/batches`, and (found the
  same way while in there) `/admin/settings/roles` were styled with
  `cursor-pointer` to look clickable, but only a small `Link` inside one
  cell actually was, clicking the status badge or empty space did
  nothing. New `components/ui/clickable-row.tsx` wraps `TableRow` in a
  Client Component that navigates on click anywhere in the row (the
  inner `Link` stays too, for keyboard focus, middle click, and "open in
  new tab"), applied to all three list pages. The KYC list also gained an
  explicit "Review →" column so it doesn't rely on hover styling alone to
  suggest it's clickable.
- **Fleet's filter bar was entirely decorative, now it's real.** The
  status pills, search box, "Filters", and "Location" control on
  `/admin/fleet` had no state or handlers behind them at all, "All" was
  hardcoded as the only pill ever shown active. New
  `app/admin/fleet/fleet-browser.tsx` is a Client Component that filters
  the fleet by status, vehicle type, and location (a dropdown built from
  the locations actually present, not a fixed list) plus a real text
  search across asset tag, agent, driver, and location, all client side
  against the already-fetched vehicle list, which is small enough that a
  server round trip per keystroke isn't worth it. `/admin/fleet/page.tsx`
  now renders this in place of the old inline markup.
- **New vehicle asset tags now suggest the next number.** Requested
  directly: "if the last one is KKE-001 the next one should be KKE-002
  same thing applies to bike or cars." `getNextAssetTag`/
  `getNextAssetTagsByType` (`lib/data/fleet.ts`) scan the vehicles
  already on file for the highest numeric suffix under each type's
  prefix (`KKE-`, `CAR-`, `BIKE-`, see the new `ASSET_TAG_PREFIXES` in
  `lib/vehicle-types.ts`) and add one. `/admin/fleet/new`'s type and
  asset tag fields are now a small Client Component
  (`vehicle-type-and-tag.tsx`) that fills in the right suggestion for
  whichever type is picked, unless the admin has already typed over it
  themselves, in which case switching the type dropdown stops
  overwriting their choice. It's only a suggestion, the field stays
  editable, a gap in the sequence or a tag entered by hand never blocks
  anyone.
- **Buttons now show a loading spinner while their click is in
  flight.** Requested directly: "make them reactive like an animation
  that shows that one has already clicked them." `Button`
  (`components/ui/button.tsx`) takes a new `loading` prop that shows a
  small spinner and disables the button. For a plain Server Component
  form (`<form action={someServerAction}>` with no local pending state of
  its own), new `components/ui/submit-button.tsx` reads
  `useFormStatus()` and passes `loading` through automatically, applied
  across roughly 20 pages (KYC review and document upload, transfers,
  reconciliation and payment batch approval, roles, staff/driver/fleet
  creation, and more). The dozen or so forms that already tracked their
  own `isSubmitting` locally (the Module 27 edit pages, sign in/up,
  password reset and change, the investor payout forms) now pass
  `loading={isSubmitting}` to their existing `Button` alongside the
  "Saving..." text swap they already had. One button was deliberately
  left alone: the audit log's "Filter" button submits a plain GET form
  for a normal page navigation, not a server action, `useFormStatus`
  never sees a pending state for that shape of form so wrapping it would
  silently do nothing.
- **Staff can now enter an investor's bank details.** Asked directly: "i
  just noticed there isn't place where to add investor's bank details i
  think it should be under or when creating contract right ?" It's on
  the investor's own record instead, on `/admin/investors/[id]`, not on
  the contract: a bank account belongs to the investor, not to any one
  contract, and this now mirrors exactly how an investor enters it
  themselves on `/investor/payout-details`, same Paystack
  resolve-before-save flow, same clearing of `paystackRecipientCode` so
  the next payout batch builds a fresh transfer recipient rather than
  reusing a stale one. New `updateInvestorBankDetails`
  (`lib/actions/investors.ts`), gated on `INVESTORS_MANAGE`, and a new
  `InvestorBankForm` Client Component. `getInvestorById`
  (`lib/data/onboarding.ts`) now also returns the bank fields so the
  detail page can show what's on file.

## Previously delivered (Module 27: editing investor/driver/staff records, a reconciliation crash fixed, and the target-achieved payout safety net)

Four things reported together: reconciliation still crashing once it was
reachable, no way to edit an investor/driver/staff record after creation,
the payout-destination control on "Add investor" not reading as an actual
checkbox, and a request to make sure payouts genuinely stop once a
contract's target is reached rather than continuing for the rest of the
term.

- **Reconciliation actually works now.** `matchProviderTransaction` and
  `dismissProviderTransaction` (`lib/actions/reconciliation.ts`) were
  bound directly to plain `<form action={...}>` elements and threw on
  every failure path (already resolved, no permission, missing amount),
  the same crash-to-generic-error-page shape as the bugs fixed in Modules
  25 and 26. This page had never actually been reachable, let alone
  exercised, until Module 26 added a sidebar link to it, so this is
  likely the very first time anyone actually clicked "Match" or "Not
  ours, dismiss". Fixed the same way as the earlier instances: both
  return `{error?}` now, and the page's two forms became small Client
  Components (`match-dismiss-forms.tsx`) that show the real message
  instead of crashing.
- **Reconciliation moved back inside Payments.** Module 26 added it as
  its own top-level sidebar item; it's removed from there now.
  `/admin/payments/batches` already has its own "Reconciliation" button
  (with an unmatched-count badge) in its header, that's the way in, same
  as before Module 26.
- **Investor, driver, and staff/agent records can now be edited.** None
  of the three had an edit screen at all, only creation. Each row on
  `/admin/investors`, `/admin/drivers`, and `/admin/settings/staff` now
  links to a detail page (`/admin/investors/[id]`, `/admin/drivers/[id]`,
  `/admin/settings/staff/[id]`) with an edit form: full name, email (also
  updates their Supabase Auth sign-in email, checked for a conflicting
  account first), phone, and either the investor's payout destination,
  the driver's agent assignment, or the staff/agent's job title/region.
  Account type (staff versus agent) isn't editable, converting one to the
  other would mean deciding what happens to an agent's collection account
  or a staff member's approval history, out of scope here.
- **Payout destination is a real checkbox now, not a dropdown.** The
  original ask was explicit: "a check box or a tick", Module 26 built it
  as a `<select>` instead. Replaced on `/admin/investors/new`, the new
  investor edit page, and the investor's own `/investor/payout-details`,
  all three now read "Keep this investor's payouts in their wallet
  instead of paying to their bank account", ticked for wallet, unticked
  (the default) for bank. The underlying field and data flow are
  unchanged, still `payoutDestination` posting `"WALLET"` or `"BANK"`.
- **A real bug found in `createDriver`**, while writing `updateDriver`
  right next to it and checking every Prisma call in the file against the
  schema: the nested `driver: { create: { phone, agentId } } }` never set
  `fullName`, even though `Driver.fullName` is a required column with no
  default. Every attempt to add a driver would have failed outright at
  the database level. Fixed by adding `fullName` to that nested create.
- **The target-achieved payout safety net asked for directly**: "I hope
  is not going to continue even after the target has reached." The
  target-achieved logic itself already existed (`recordPayout` in
  `lib/payments/batch-processor.ts` already flips a contract to
  `TARGET_ACHIEVED` and creates its `OwnershipTransfer` the moment
  `totalPaidToInvestor` reaches `targetPayoutAmount`, both automatic
  since an earlier module), but `getDueScheduleEntriesForBatch`
  (`lib/data/payments.ts`) had no `contract.status` filter at all. A
  schedule entry belonging to a contract that hit its target early, but
  whose own due date hadn't arrived yet, could still surface on "New
  payment batch" and get paid, a genuine overpayment past the target.
  Fixed with `contract: { status: "ACTIVE" }` in that query, so a
  contract leaving ACTIVE removes all its remaining entries from
  consideration permanently, plus a second check inside
  `createPaymentBatch` itself (`lib/actions/payments.ts`) that drops any
  submitted entry whose contract isn't ACTIVE anymore, in case a "New
  batch" tab was left open across a target being hit. That action was
  also throw-bound to a plain form the same way reconciliation's actions
  were, converted to `{error?}` at the same time, `/admin/payments/batches/new`
  is now a Client Component (`new-batch-form.tsx`).
- **Staff are now notified when a target is achieved, not just the
  investor.** `recordPayout` already told the investor (bundled into
  their "you've been paid" notification), nobody on staff ever heard
  about it, the only way to notice was checking `/admin/transfers` or the
  dashboard's count. `notifyStaffOfTargetAchieved` (new, in
  `lib/payments/batch-processor.ts`) emails everyone holding
  `TRANSFER_VERIFY` the moment a contract crosses its target, same
  never-throws discipline as `sendNotification` itself.
- **A cosmetic gap knowingly left as is**: schedule entries for a
  contract's remaining term after it hits its target early stay in
  whatever status they were in (typically `UPCOMING`), they are never
  relabeled. They can never be paid (the fix above makes sure of that)
  and never show to staff, this is purely about how they'd read if
  someone queried the database directly. Not worth a new schema enum and
  another migration for a display-only concern, noted in
  `docs/architecture/CURRENT_STATE.md`'s Known gaps instead.

## Previously delivered (Module 26: forced/self-service password changes, automatic payout routing, and a missing sidebar link)

Four things asked for together: real security around the temporary
passwords staff hand out, a way for anyone to change their own password,
payout routing decided once by the investor instead of picked by staff
every batch, and a missing "Reconciliation" link in the sidebar.

- **Forced password change, every account type.** `User.mustChangePassword`
  is true only for an account someone else created with a generated
  temporary password (investor, driver, staff, or agent, via
  `createInvestor`, `createDriver`, `createStaffOrAgentAccount`), false
  for anyone who chose their own (self-signup, `/setup`). Every portal
  layout redirects to the new `/change-password` before rendering
  anything else while it's true. Requires the current password (proving
  they actually have the temporary one, verified against a throwaway
  Supabase client that never touches the real session's cookies,
  `createSupabaseAnonClient` in `lib/supabase/server.ts`), a new one at
  least 8 characters, and clears the flag once it succeeds.
- **Voluntary password change, everywhere.** A "Change password" link now
  sits in `AppShell`'s account area (next to Sign out), so it shows up in
  every portal, admin, agent, investor, and driver, all from one shared
  component. Same page, same action (`changePassword` in
  `lib/actions/auth.ts`), the only difference from the forced flow is the
  header copy.
- **On "security against SQL injection and other attacks"**, asked
  directly: audited (a full grep, not a claim), zero raw SQL anywhere in
  this codebase, every query goes through Prisma's parameterized query
  builder, so SQL injection isn't a risk this app's code can introduce.
  Zero `dangerouslySetInnerHTML` either, React escapes JSX by default.
  Server Actions get Next.js's own built-in CSRF protection. Passwords
  are never stored or hashed by this app at all, Supabase Auth owns that
  entirely. What isn't and can't be app code: rate limiting on repeated
  sign-in attempts (Supabase Auth's own job) and a bot/abuse layer in
  front of the whole deployment (infrastructure, part of a real go-live
  checklist, not a code change). Full detail in
  `docs/architecture/CURRENT_STATE.md`'s new "Account security" section.
- **Automatic payout routing.** Previously staff ticked a "Wallet"
  checkbox by hand, per row, every single time a payment batch was
  created, exactly the kind of repetitive manual step a mistake slips
  into. Now it's the investor's own standing choice
  (`InvestorProfile.defaultPayoutDestination`), set once at onboarding on
  `/admin/investors/new` and editable anytime after by the investor
  themselves on `/investor/payout-details`. `createPaymentBatch`
  (`lib/actions/payments.ts`) copies it onto each `PaymentBatchItem`
  automatically when a batch is created, staff still see exactly where
  each payout is headed on the New batch screen, a "Bank" or "Wallet"
  badge per row, they just can't change it there anymore, nothing to
  tick, nothing to get wrong.
- **A fourth instance of the throw-in-a-form-action bug**, found while
  extending the payout-details page: `updatePayoutDetails`
  (`lib/actions/investor-profile.ts`) threw on a Paystack failure instead
  of returning it, the same crash-to-generic-error-page shape as the
  three bugs fixed in Module 25. Fixed the same way, returns `{error?}`
  now, `/investor/payout-details` became a Client Component form so the
  message actually shows. Four times in two modules is a real pattern,
  flagged as a good candidate for a dedicated audit pass in
  `docs/architecture/CURRENT_STATE.md`'s Known gaps, not chased down
  everywhere reactively in this module.
- **Missing "Reconciliation" sidebar link, fixed.** `/admin/payments/reconciliation`
  has existed and worked since Module 15, but nothing in the sidebar ever
  linked to it, the only way there was knowing the exact URL by heart.
  Added to `app/admin/layout.tsx`.
- **Migration needed, this time run on your own machine, not hand-written
  here.** Two new columns (`User.mustChangePassword`,
  `InvestorProfile.defaultPayoutDestination`). Every earlier migration in
  this project was hand-written in the sandbox because it couldn't reach
  Prisma's binary download server, your machine now can (confirmed in
  Module 25 via a real `npx prisma migrate status`), so this one should
  be generated properly there instead of hand-authored blind:

  ```bash
  npx prisma migrate dev --name add_password_and_payout_preference
  npx prisma generate
  ```

## Previously delivered (Module 25: a first-run admin bootstrap, and small cleanup)

There was a real chicken-and-egg gap: every account-creation flow in
this app (staff, agent, investor) requires a signed-in staff member
holding a specific permission, and on a brand new database nobody has
any permission, because the account that grants permissions doesn't
exist yet. Before this, the only way in was a manual database or
Supabase dashboard edit.

- **`/setup`** (new). A one-time page, linked in small print at the
  bottom of `/admin-sign-in` (and nowhere else) for whoever is standing
  up a new deployment. It creates the very
  first Admin account, `bootstrapFirstAdmin` in `lib/actions/auth.ts`.
  Double-gated rather than permission-gated, since nothing to check a
  permission against exists yet: it refuses unless a `SETUP_BOOTSTRAP_KEY`
  environment variable is set and matches what's submitted, and it
  refuses unless the database has zero `StaffProfile` rows, so it
  permanently stops working the instant a first admin exists, created
  here or by hand. See `.env.example` for the new variable and the doc
  comment on `bootstrapFirstAdmin` for the full reasoning, including one
  disclosed edge case (a same-instant double-submit race, benign, not a
  security hole).
- **Bug found and fixed within this same module, before it ever really
  worked:** the first version of this page and `bootstrapFirstAdmin` both
  called `prisma.staff.count()`. There is no `staff` model, the Prisma
  model is `StaffProfile`, its Client accessor is `prisma.staffProfile`.
  `prisma.staff` is `undefined`, calling `.count()` on it threw
  immediately, which is what the generic Sentry error page the project
  owner hit on their very first visit to `/setup` actually was. ESLint
  doesn't type-check, so this passed lint clean and only surfaced at
  runtime, the exact gap the "never trust tsc, but never trust ESLint
  alone either" caveat elsewhere in this document is about. Fixed by
  using `prisma.staffProfile.count()` in both places.
- **A second bug found, pre-existing, not from this module:** clicking
  "Create" next to an agent with no collection account yet on
  `/admin/settings/staff` also hit the same generic error screen.
  `retryAgentCollectionAccount` (`lib/actions/staff.ts`) called
  `throw new Error(result.error)` when Paystack rejected the request
  (an invalid key, an unverified business category, a bad bank code,
  whatever the real reason was), which crashed the whole Server Action
  and threw away the actual message, exactly the failure mode this
  button most needed to explain, since it only shows up when something
  really is wrong. `provisionAgentCollectionAccount`
  (`lib/payments/collection-account.ts`) was already written to never
  throw, returning a plain `{ ok: false, error }` specifically so a
  caller could display it, this action just wasn't using that. This
  likely went unnoticed because exercising it for real needs a
  (mis)configured `PAYSTACK_SECRET_KEY`, unlikely to have happened
  before now. Fixed by redirecting back to `/admin/settings/staff` with
  the real error in the query string instead of throwing, the page now
  shows it as a banner.
- **A third bug found, also pre-existing, in every portal's sidebar**:
  the highlighted nav item never updated after the first click. Every
  portal layout (`app/admin/layout.tsx`, `app/agent/layout.tsx`,
  `app/investor/layout.tsx`, `app/driver/layout.tsx`) hardcoded
  `active: true` on its own Dashboard item in a plain module-level
  array, a static value that never changed no matter what page was
  actually open, and `AppShell` (`components/layout/app-shell.tsx`)
  rendered plain `<a>` tags instead of `next/link`'s `<Link>`, so every
  click away from Dashboard was also a full page reload, not a
  client-side transition. Fixed with a new `SidebarNav`
  (`components/layout/sidebar-nav.tsx`), a small Client Component using
  `usePathname()` (the only way to know the current URL after the
  initial render, a Server Component layout has no equivalent) that
  recomputes the active item on every navigation instead of trusting a
  value frozen at build time. Matching is prefix-based (`/admin/wallet`
  stays lit on `/admin/wallet/withdrawals`), and picks the single
  longest matching href across the whole sidebar rather than testing
  each item alone, since some hrefs are themselves prefixes of others in
  the same list (`/admin/settings` and `/admin/settings/staff`, for
  instance), naive independent matching would have lit up both at once.
  `active` dropped from the `NavItem` type entirely, nothing sets it
  anymore, `SidebarNav` computes it fresh every render.
- **Cleanup**: `app/admin/drivers/new/success/page.tsx`'s copy still said
  "There is no driver app or dashboard to sign into yet," left over from
  Module 22, false since Module 24 shipped the real driver portal. Now
  points to `/sign-in` instead. `docs/architecture/CURRENT_STATE.md`'s
  Known gaps also got a pass: the Module 14 and Module 23 wallet
  migrations are now marked resolved, `npx prisma migrate status` run
  against the real Supabase database confirmed "4 migrations found,
  Database schema is up to date!", the wallet system and the withdrawal
  cancel button both actually work now, not just in this sandbox's
  hand-reviewed migration files.

## Previously delivered (Module 24: a driver portal, and a sign-in routing bug found along the way)

Every driver has had a real, trackable Supabase Auth account since
Module 22, ready the moment they choose to sign in, but nothing existed
for that account to sign into. This closes that gap, and along the way
found a real bug in how the shared staff sign-in tab routed people.

- **`/driver/dashboard` and `/driver/deposits`** (new). Deliberately
  narrow compared to the agent portal: a driver has exactly one current
  vehicle, not a fleet, so there's no driver equivalent of
  `/agent/vehicles`. The dashboard shows their Paystack collection
  account (same copy-to-clipboard treatment the agent dashboard uses,
  with copy adjusted for a driver's actual situation, someone paying them
  directly rather than them remitting to someone else), their current
  vehicle assignment, an 8-week deposits-received trend chart, and a
  short recent-deposits table. `/driver/deposits` is the full history
  behind that table plus an all-time total, the same shape as
  `/agent/remittances`. `lib/data/driver.ts` is the new query layer,
  `getDriverDeposits` doing double duty as both that full history and the
  source the dashboard's own short preview slices from, rather than two
  near-identical queries.
- **Bug found and fixed, not by a bug report:** while wiring up where a
  driver should land after signing in, found that the shared "Staff /
  Agent" tab on `/sign-in` always sent a successful, non-Admin sign-in
  straight to `/admin/dashboard`, no matter what kind of account it
  actually was. An agent signing in there would have landed on the
  operations console instead of `/agent/dashboard`, this had apparently
  never been tried, every test of that tab in this project so far used a
  staff account. Fixed with `resolveStaffPortalDestination`
  (`lib/actions/auth.ts`), which checks whether the signed-in account is
  actually staff, an agent, or a driver (in that priority order) and
  routes to that portal instead of assuming. The tab is now labeled
  "Staff / Agent / Driver" to match what it's always actually covered.

## Previously delivered (Module 23: a Company Admin role, a wallet withdrawal cancel button, and a much richer demo seed)

Three separate, unrelated pieces of feedback landed together this round.

- **A second admin tier: "Company Admin".** The system `Admin` role
  (`/admin-sign-in`) can't be edited, can't be deleted, and its last
  member can never be removed, that's deliberate, it exists so the
  platform's own configuration always has a way in. It was never meant
  to be the account real day-to-day company administration runs through,
  though, and up to this module nothing else came close: every other
  seeded role (Finance, Approver, Operations, ComplianceReviewer) only
  covers one narrow slice. `lib/rbac/permissions.ts`'s `DEFAULT_ROLE_SEED`
  now includes `"Company Admin"`, every permission Admin has except
  `staff.manage`, `rbac.manage`, and `settings.manage`, the three that
  control who has access to what at all. Those three stay reserved for
  the system Admin role; everything else, investors, fleet, contracts,
  drivers, payments, wallet, KYC review, the audit log, is available to a
  staff account with this role, created the normal way at
  `/admin/settings/staff/new` and signed in the normal way at `/sign-in`'s
  Staff/Agent tab, not `/admin-sign-in`. Unlike Admin, it's an ordinary
  role: it can be renamed, have permissions added or removed, or be
  deleted from `/admin/settings/roles` like any role a staff member
  creates themselves, this is only where it starts. **Run
  `npm run db:seed` after pulling this**, the same one-time step every
  new permission or role in this project has needed, to actually create
  the role and grant it these permissions.
- **A wallet withdrawal can now be cancelled by the investor who
  requested it.** `/investor/wallet` had a "Request withdrawal" button
  since Module 14, but no way back out of one once submitted, only staff
  could approve or reject it. `cancelWalletWithdrawal`
  (`lib/actions/wallet.ts`) lets the investor cancel their own request
  while it's still `PENDING_APPROVAL`, before any money has actually
  moved (the wallet isn't debited until staff approve, so there's nothing
  to reverse). This needed a real, if small, schema change: a new
  `CANCELLED` value on `WalletWithdrawalStatus`, kept distinct from
  `REJECTED` on purpose, since one is always the investor's own decision
  and the other is always staff's. See "Prisma CLI" in Known gaps, the
  migration (`prisma/migrations/20260901120000_add_wallet_withdrawal_cancelled`)
  is hand-written for the same reason every migration in this project has
  been, and needs `npx prisma migrate deploy` (or `npm run db:migrate`)
  run against a real database before this status can actually be written.
- **The demo seed (`npm run db:seed:demo`) is far more thorough now.**
  The original version created one investor, one keke, one contract,
  enough for the payout charts and not much else. It now creates 4
  investors (varied KYC status), 2 agents in different regions, 5 drivers
  (2 with a real Module 22 account, 3 without, so the contrast is visible
  rather than theoretical), 9 vehicles across every type and status
  (including one in `MAINTENANCE` with real maintenance records, and one
  `RETIRED`), 3 contracts (one on its original 12-week schedule, one
  freshly started so two investors are ever due on the same day, one
  already fully paid out and transferred, so `/admin/transfers` has a
  completed example), a `companyadmin.demo` login for the new role above,
  wallet activity in every reachable state including one open request
  specifically so the new cancel button has something to click, and one
  unmatched Paystack transaction sitting in the reconciliation queue.
  Deliberately still not seeded, on purpose, not by oversight: a
  historical payment batch (the README's own "click New batch" tutorial
  already demonstrates this with a real batch rather than a risk of a
  fabricated one drifting from what the real code produces, and this
  seed makes sure two different investors are due today so that tutorial
  always has something to act on) and any `Document`/`KycDocument` rows
  (a database row pointing at a Storage path nothing was ever actually
  uploaded to would make "View" a broken link, worse than the honest
  empty state already there).

## Previously delivered (Module 22: every driver gets a real trackable app account, and a Windows setup fix)

Two unrelated fixes landed together this round, one direct product
correction, one a real setup friction a person hit on their own machine.

- **Every driver now gets a real Supabase Auth account at creation,
  no exceptions.** Module 21 shipped `/admin/drivers/new` with app access
  as optional, most drivers were expected to never sign in and so most
  would never get a User row at all, matched by a disclosed "untracked
  SMS" gap for exactly that case. That was a real design choice, not an
  oversight, but the wrong one: a driver not choosing to sign in today is
  not the same as a driver not having an account. `createDriver`
  (`lib/actions/drivers.ts`) now makes a real Supabase Auth account, the
  same generated-temporary-password pattern `/admin/settings/staff/new`
  and `/admin/investors/new` already use, for every driver added through
  the app, and creation now requires an email address alongside the
  phone number for exactly that reason. A new
  `/admin/drivers/new/success` screen shows the one-time password, with
  copy that's honest about the fact that a driver doesn't need it to get
  paid, their collection account works either way, it exists only for
  the day they choose to sign in. `Driver.userId` stays optional on the
  schema, not because new drivers might not get one, but so a driver
  created before this module, or directly against the database (the seed
  script), doesn't retroactively break. Practically, this closes the
  `sendUntrackedSms()` gap from Module 21 for every driver going forward,
  it now only ever applies to a pre-Module-22 driver who was never given
  an account; see "Known gaps" in `docs/architecture/CURRENT_STATE.md`
  for the updated framing. **This does not include a driver portal**,
  there is still no `app/driver/` route or driver tab on `/sign-in`
  anywhere in this app, only a real account now exists for one to sign
  into later. Building what a driver would actually see once signed in
  is separate, not-yet-scoped work, flagged in "Known gaps" rather than
  quietly left implied.
- **Windows: a bare `prisma` command was never going to work.** A person
  running this project on Windows hit
  `prisma : The term 'prisma' is not recognized...` in PowerShell after
  typing `prisma migrate deploy` directly. This was never a bug, `prisma`
  is a devDependency here, not something installed globally, the same
  command only ever worked by accident on machines where someone had
  separately installed the Prisma CLI globally too. `npx prisma ...`
  always resolves it correctly regardless of OS and still works exactly
  as every earlier module's instructions describe, but typing `npx`
  correctly every time is easy to forget, so `package.json` now also
  ships `npm run db:migrate` (`prisma migrate deploy`),
  `npm run db:migrate:dev` (`prisma migrate dev`), `npm run db:generate`,
  and `npm run db:studio` as shorter, OS-proof equivalents. The "Running
  this locally" and "Testing against a local Postgres database" sections
  below now call this out directly rather than leaving it to be
  discovered the hard way.

## Previously delivered (Module 20: dashboard polish, and a chart bug found along the way)

Three dashboards (admin, investor, agent) already had real charts or none
at all; this module gives investor and agent their own trend charts using
the same visual language as admin's, fixes a real display bug found while
touching the admin chart, and pulls the duplicated SVG/bucketing code
that would otherwise have been written a third time into two shared
pieces.

- **`components/charts/area-trend-chart.tsx`** (new). The line-and-area
  SVG chart that has shown admin's "realized payments" since Module 3 is
  now a standalone component (`weeks`, `amounts`, a `formatAmount`
  formatter, an empty-state message, a required `gradientId` since SVG
  `<defs>` ids are global to the page and two charts on one page sharing
  one would silently reuse whichever gradient painted first). The admin
  dashboard's own chart was switched over to it with no visual change,
  it's the exact same markup, just no longer duplicated.
- **`lib/data/chart-helpers.ts`** (new): `buildWeeklyTrend()` and
  `weeksAgoStart()`, the week-bucketing math that used to live only
  inside admin's `getWeeklyPayments`. Investor and agent dashboards now
  call the same function against their own scoped Prisma query
  (`PaymentTransaction` filtered by `investorId` or `agentId`
  respectively, both fields `recordPayout` in
  `lib/payments/batch-processor.ts` already stamps on every payout or
  remittance) rather than three copies of the same bucketing logic
  drifting apart over time.
- **Investor dashboard: "Payouts realized (last 8 weeks)".** A new chart
  card between the stat cards and the vehicles grid, same shape as
  admin's chart, scoped to this one investor's own realized payouts.
- **Agent dashboard: "Remittances collected (last 8 weeks)".** A new
  chart card between the weekly target/paid stat cards and the vehicles
  table. This dashboard had no chart of any kind before this module, it
  was the plainest of the three.
- **Bug found and fixed, unrelated to adding the new charts:** the admin
  "Fleet by status" donut chart's ring segments only ever covered active,
  maintenance, unassigned, and pending vehicles, but the number drawn in
  the donut's center (and the `total` its arc lengths are computed
  against) includes retired vehicles too. Any fleet with at least one
  retired vehicle was drawing a ring whose colored arcs summed to less
  than the full circle, a visible gap where retired vehicles should have
  been represented, while the center number quietly counted them anyway.
  Fixed by adding a fifth "Retired" segment and legend row (teal, the one
  color in this app's palette not already used elsewhere on this page).
  Caught while reading through the donut's math to move the chart it sits
  beside into the new shared component, not by a bug report.

## Previously delivered (Module 21: driver management, real Paystack collection accounts, and deposit SMS alerts)

The database and the Paystack webhook handler have had the shape for a
driver to have their own Dedicated Virtual Account since early on,
`Driver.paystackCustomerCode`/`paystackDvaAccountNumber` mirror `Agent`'s
own fields, and `handleChargeSuccess` already matched a payment to a
driver by customer code. What this module found, while building the
feature a driver-DVA-plus-SMS idea actually asked for, is that none of it
was ever switched on: nothing anywhere called the function that actually
asks Paystack to create one, not for drivers, not for agents either, and
there was no way to even create a driver record through the app at all,
only the seed script ever had.

- **`/admin/drivers` and `/admin/drivers/new`** (new). The first
  in-app way to add and see drivers, previously they only ever existed
  in `prisma/seed-demo.ts`. Lists every driver, their agent, their
  current vehicle, whether they have app access at all (most won't,
  `Driver.userId` is optional), and their collection account status. The
  vehicle detail page (`/admin/fleet/[id]`) also gained an inline
  assign/change/unassign control rather than only ever showing the
  current driver read-only.
- **`lib/payments/collection-account.ts`** (new):
  `provisionAgentCollectionAccount()` and
  `provisionDriverCollectionAccount()`, the code that was always missing.
  Idempotent (an agent or driver who already has a `paystackCustomerCode`
  is left alone, calling Paystack's customer endpoint twice for the same
  person creates two separate customers and two DVAs), never throws,
  returns a plain `{ok, error?}` result so a UI can show what happened
  instead of an uncaught exception. Wired into agent creation
  (`lib/actions/staff.ts`) and driver creation
  (`lib/actions/drivers.ts`), both best-effort, a Paystack failure never
  blocks the account itself from being created, and both screens
  (`/admin/settings/staff`, `/admin/drivers`) show a "Create" retry
  button next to anyone whose collection account isn't set up yet,
  including every agent created before this module.
- **The placeholder-email judgment call.** Paystack's customer endpoint
  requires an email, there is no phone-only path (confirmed against
  their current docs, not assumed). An agent always has one, `Agent.userId`
  is required. A driver might not, most never get a User account at all.
  For a driver with no linked User, `provisionDriverCollectionAccount`
  makes one up, `driver.<digits-of-their-phone>@no-reply.keke-platform
  .internal`, purely to satisfy that required field. It is never used to
  send actual mail, the driver's real channel is the SMS this module
  exists to send. A phone number is required to create a driver for this
  reason, and because a collection account with no way to tell its owner
  it was paid into defeats the point.
- **Deposit SMS alert.** `handleChargeSuccess` now notifies whoever
  matched, after its `$transaction` commits, same "no I/O inside a
  transaction" rule the payout notifications in
  `lib/payments/batch-processor.ts` already follow. An agent (always a
  User) goes through the normal tracked `sendNotification`, email and
  SMS. A driver with a linked User does too, SMS only. A driver with no
  User gets a new function, `sendUntrackedSms()` in
  `lib/notifications/send-notification.ts`, a plain SMS with no
  `Notification` row behind it, `Notification.recipientUserId` is a
  required foreign key, there is no User to attach one to. This is a real
  gap disclosed on purpose: that message will never show up in any
  notification history or admin screen the way every other one in this
  app does, a genuine send failure there is only visible in Sentry.
- **What this deliberately does not touch.** A USSD balance-check
  (`*XXX#` style) was part of the original idea and was explicitly parked
  after discussion: Termii, already integrated here, does not offer USSD
  as a product, and a real short code has to be leased from a telecom
  aggregator, a business/registration step with real cost and lead time,
  not a code change. Nothing about that is built or stubbed here.

## Previously delivered (Module 19: automated test suite, and a second bug caught while writing it)

Vitest is now wired up (`npm test`, `npm run test:watch`), with 79 tests
across 6 files covering the pure functions and the money-sensitive
business logic that never had any automated coverage before this. This
sandbox cannot reach a real Postgres through Prisma (see "Testing against
a local Postgres database" below and the Known gaps note), so this is
deliberately scoped to what's actually verifiable here: real unit tests
for pure functions, and mocked-Prisma-client tests for logic that's
tightly coupled to the database but whose business rules matter enough to
pin down anyway.

- **`vitest.config.mts`.** Node environment, `**/*.test.ts` files
  alongside the code they test rather than a separate `__tests__` tree,
  the same `@/*` path alias as the app itself. `.mts` (not `.ts`) and
  `import.meta.dirname` (not `__dirname`) specifically to avoid ESM/CJS
  ambiguity warnings from Vite's native config loader, this project has no
  `"type": "module"` in `package.json`.
- **Pure-function unit tests, no mocking needed:** `lib/utils.test.ts`
  (`formatNaira`, `formatDate`/`formatDateTime`, `startOfWeek`, `addDays`,
  `weekLabel`, `getInitials`), `lib/schedule.test.ts` (`generateScheduleDates`
  for all three frequencies, including explicit regression tests for the
  month-end clamping fix from Module 18 so it can never silently regress),
  `lib/payments/paystack-client.test.ts` (kobo/naira conversion,
  `verifyPaystackSignature`), `lib/notifications/termii-provider.test.ts`
  (`toTermiiPhoneFormat`'s various input shapes).
- **Mocked-Prisma tests for money logic, using `vitest-mock-extended`'s
  `mockDeep<PrismaClient>()`:** `lib/payments/batch-processor.test.ts`
  (`applyTransferOutcome`, `applyWalletHold`,
  `applyWalletWithdrawalTransferOutcome`, including the schedule-allocation
  math and the target-crossing `OwnershipTransfer` creation) and
  `lib/payments/webhook-handler.test.ts` (`recordProviderTransaction`'s
  idempotency on a duplicate `providerRef`, and `processPaystackEvent`'s
  routing across agent/driver/unmatched `charge.success` and
  transfer.success/failed/reversed, with `batch-processor`'s own functions
  stubbed out so this file only tests webhook-handler's routing, not
  ledger math already covered by the other file). Both mock `$transaction`
  to invoke its callback with the same mock object as `tx`, so assertions
  set up on the outer mock also catch calls made inside a transaction. The
  `Decimal` fields on `PaymentBatchItem`/`InvestmentContract` are stood in
  with plain numbers in these tests, a deliberate simplification noted in
  each file's own top comment, not a claim that Prisma's `Decimal` behaves
  identically to `number` in every case.
- **Bug found and fixed, unrelated to writing the tests themselves:** while
  reasoning through what test cases `verifyPaystackSignature` needed,
  found that it called `crypto.timingSafeEqual` on the expected and
  received signature buffers without checking their lengths first.
  `timingSafeEqual` throws a `RangeError` on a length mismatch instead of
  returning `false`, so a malformed or wrong-length `x-paystack-signature`
  header (an attacker probing the webhook, or simply a broken client)
  would have crashed the webhook route with a 500 instead of cleanly
  returning `false` and a 401. Fixed by comparing buffer lengths before
  calling `timingSafeEqual`, with a dedicated regression test asserting
  the function does not throw on a malformed header.

## Previously delivered (Module 18: error tracking, and a build-breaking bug caught along the way)

`NEXT_PUBLIC_SENTRY_DSN` has sat in `.env.example` since Module 1 with
nothing reading it. This wires up the actual Sentry SDK, and while
verifying it with a real `next build` (rather than just `npm run lint`,
which is all this project had ever been checked with, `tsc` is unreliable
in the sandbox this was built in), found and fixed a bug that would have
failed every production build regardless of Sentry.

- **`@sentry/nextjs`, `instrumentation.ts`, `instrumentation-client.ts`,
  `next.config.ts`.** Standard current-SDK setup: `instrumentation.ts`
  calls `Sentry.init` once per server process and exports `onRequestError`
  (catches errors from nested Server Components an error boundary can't
  reach on its own), `instrumentation-client.ts` does the same for the
  browser, and `next.config.ts` is wrapped in `withSentryConfig` so a
  captured error can be mapped back to real source, not minified code,
  when `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are set. All of
  it, including the DSN itself, is optional: leave it all unset and
  Sentry stays fully off, `enabled: Boolean(NEXT_PUBLIC_SENTRY_DSN)` is
  explicit about that rather than relying on an empty DSN quietly
  no-opping, the same pattern Resend and Termii already follow.
- **Where it actually gets called manually.** Most errors in this app are
  either already turned into a returned `{error}` value the UI shows (most
  Server Actions), or bubble up and get caught automatically by the SDK's
  own wrapping of Server Actions/Route Handlers/Server Components. The
  manual `Sentry.captureException`/`captureMessage` calls added this
  module are specifically for the handful of places that deliberately
  swallow an error by design and previously had nothing else watching:
  the Paystack webhook handler's catch (a failed webhook interpretation
  still returns 200 to Paystack on purpose, so nothing else would ever
  know it happened), `sendNotification` (a FAILED `Notification` row sits
  in the database with no UI anywhere surfacing it), `writeAuditLog`'s own
  catch (Module 17), and the compensating rollback in `signUpInvestor`
  when the Postgres half of account creation fails after the Supabase
  Auth half already succeeded.
- **`app/error.tsx` and `app/global-error.tsx`.** This app had zero error
  boundaries before this module, an uncaught render error would have hit
  Next's generic "Application error" screen with nothing reported
  anywhere. `error.tsx` catches everything below the root layout (nearly
  everything), branded to match the rest of the app, reports to Sentry in
  a `useEffect`, and offers a "Try again" button. `global-error.tsx`
  catches the rare case of the root layout itself throwing, Next.js
  requires it to render its own `<html>/<body>` since the root layout is
  gone at that point, so it's deliberately plain inline styles rather than
  depending on `globals.css`, which never loads in that scenario.
- **Bug found and fixed, unrelated to Sentry itself:** verifying all of
  the above with `next build` (Turbopack, what this app's build script
  actually uses) failed with "Server Actions must be async functions" on
  `generateScheduleDates` in `lib/actions/contracts.ts`. That file starts
  with `"use server"`, which means Next.js treats every top level export
  as a callable Server Action, `generateScheduleDates` is a plain
  synchronous date-math helper that was never meant to be one, it was
  just reused by `lib/actions/wallet.ts`. This would have failed every
  real production build, on Vercel or anywhere else, regardless of
  whether Sentry was ever added, `npm run lint` alone never catches it.
  Moved it, and its `Frequency` type, to a new plain module,
  `lib/schedule.ts`, with no behavior change, both call sites now import
  from there. Caught by actually running the build to verify this
  module's own changes, not by a bug report.

## Previously delivered (Module 17: audit log)

The `AuditLog` model, and its permission `AUDIT_LOG_VIEW`, both existed in
the schema and the permission catalog from Module 1 with no reader or
writer anywhere in the app, exactly the state `Document` and
`RECONCILIATION_VIEW` were in before Modules 16 and 15 wired them up. This
module closes the last of that particular kind of gap: every staff
decision this app already gates behind a permission now writes a row,
before it happens, that a different staff member can look back on later.

- **`lib/audit.ts`.** One `writeAuditLog()` helper, called from twenty call
  sites across nine `lib/actions/*.ts` files: payment batch approve/reject,
  ownership transfer verify/approve/reject, wallet withdrawal
  approve/reject/mark-paid, wallet vehicle funding, KYC document and
  investor review, role create/delete, role permission toggle, role
  assignment create/remove, reconciliation match/dismiss, document delete,
  system setting update, and staff/agent account creation. Records who
  (`actorUserId`, the signed in `User`, not just their staff profile),
  what (`action`, a dot-separated `entity.verb` string like
  `payment_batch.approve`), and a `beforeState`/`afterState` JSON snapshot
  of whatever changed, wherever there was a meaningful before to capture.
  Never throws, the same discipline `sendNotification` already followed,
  a failed audit write must never make an otherwise successful staff
  decision look like it failed. Where the underlying change already ran
  inside a `$transaction` (a wallet withdrawal approval, vehicle funding
  from a wallet, a reconciliation match), the audit write goes in the same
  transaction, so the two can never disagree about whether something
  actually happened.
- **`/admin/audit-log`**, gated by `AUDIT_LOG_VIEW` (granted to Admin by
  default, same as every permission, any other role can be given it from
  `/admin/settings/roles` without a reseed). Lists the most recent 100
  entries, newest first, each showing the actor, the action, which entity
  it touched, and a `<details>` disclosure with the before/after JSON when
  there is one to show. A dropdown filters by entity type, built from the
  data itself rather than a hard-coded list. No schema or migration
  change was needed for any of this, `audit_logs` has existed in the
  database since the very first migration.

## Previously delivered (Module 16: document management)

The `Document` model has sat in the schema unused since Module 1, and
`/investor/documents` carried an honesty card admitting that contract
documents "aren't available to view here yet." This module wires the
model up end to end: staff can attach files to a contract or a vehicle,
and an investor can see the ones staff chose to share with them.

- **Storage.** A new private Supabase Storage bucket, `documents`, kept
  separate from `kyc-documents` on purpose: identity documents and
  contract/vehicle documents have different visibility rules and no
  reason to share a bucket. Like `kyc-documents`, this bucket is not
  created by any migration or seed script, it is a project-level setting
  that has to be created by hand once in the Supabase dashboard (Storage,
  New bucket, name it exactly `documents`, leave it Private). Files are
  uploaded through the service-role client, only the storage path is
  recorded in Postgres, and every view is a short-lived (10 minute)
  signed URL generated server-side, the exact pattern `lib/kyc-storage.ts`
  already established. Accepts PDF, JPG, PNG, or WEBP up to 15 MB.
- **`lib/document-storage.ts`, `lib/data/documents.ts`,
  `lib/actions/documents.ts`.** `getContractDocuments` and
  `getVehicleDocuments` for the two staff detail pages (both see every
  document regardless of visibility), `getInvestorVisibleDocuments` for
  the investor page (only documents marked `PRIVATE_OWNER` on a contract
  that belongs to them). `uploadDocument` and `deleteDocument` are gated
  by whichever domain permission the upload actually belongs to,
  `contracts.manage` for a document attached to a contract,
  `fleet.manage` for a vehicle-only one (a maintenance receipt or asset
  photo with no contract at all). No new permission key was added for
  this, reusing the two that already exist avoids another
  `npx prisma db seed` run for a feature this size.
- **`components/documents/document-section.tsx`.** One shared Server
  Component, an upload form plus a document list, used by both the admin
  contract detail page and the admin fleet detail page. Each upload
  chooses a type from a caller-supplied list and, on the contract page
  only, a visibility: staff only (the default) or this investor too.
  Deleting removes both the Storage object and the row.
- **Wired in.** `/admin/contracts/[id]` and `/admin/fleet/[id]` each grew
  a "Documents" card at the bottom. `/investor/documents` grew a
  "Contract documents" section listing every document staff marked
  visible to them, each with a "View" link to its signed URL, and the
  honesty card about this not being built yet is gone.

## Previously delivered (Module 15: reconciliation, and a wallet withdrawal webhook bug caught along the way)

The admin dashboard has said "N unmatched Paystack transactions awaiting
reconciliation" since Module 3, with nowhere to click. This closes that
dead end, and while tracing exactly how a transaction ends up UNMATCHED,
found and fixed a real bug in last module's wallet withdrawal code.

- **`/admin/payments/reconciliation`**, gated by `payments.reconciliation.view`
  (already existed, previously granted but nothing to grant access to).
  Lists every `ProviderTransaction` stuck at `UNMATCHED`: a `charge.success`
  whose Paystack customer code didn't resolve to any agent or driver (or
  had none at all), decoded from the stored raw payload for display
  (amount, customer email/code, reference), with the full raw payload one
  click away in a `<details>` disclosure for anything the summary
  doesn't show. Staff either match it to a vehicle, which applies it
  exactly the way the automatic handler would have (same schedule-entry
  and target-achieved logic, `findEarliestUnpaidScheduleEntry` in
  `lib/payments/webhook-handler.ts` is now exported and shared by both
  paths rather than duplicated), or dismiss it as not belonging to this
  app at all. A "Reconciliation" link with an unmatched-count badge now
  sits next to "New batch" on `/admin/payments/batches`, and the
  dashboard's alert links straight there.
- **Bug found and fixed**: Module 14's wallet withdrawal approval calls
  Paystack's transfer API with `reference: withdrawal.id`, the same
  pattern payment batch items use, but `handleTransferUpdate` in
  `lib/payments/webhook-handler.ts` only ever looked up that reference
  against `PaymentBatchItem`, never `WalletWithdrawal`. A real
  `transfer.success`/`transfer.failed` webhook confirming a wallet
  withdrawal's transfer would have landed in the reconciliation queue
  instead of updating the withdrawal, every single time, silently
  defeating the automatic confirmation path. Caught while tracing this
  exact code for the reconciliation feature, not by a bug report. Fixed
  with a new `applyWalletWithdrawalTransferOutcome`
  (`lib/payments/batch-processor.ts`), idempotent the same way
  `applyTransferOutcome` is, and `handleTransferUpdate` now checks both
  tables before giving up and marking a transaction unmatched.

## Previously delivered (Module 14: investor wallet)

A whole new feature this time, not a bug fix: investors can now grow a
balance inside the app instead of only ever being paid straight to their
bank account. Three constraints came directly from the company briefing
and shaped every decision below: the wallet is a ledger figure, not a
real money-holding account, the real cash always stays in the company's
bank account; converting a wallet balance into a new vehicle's contract is
always a staff decision, the system never does this on its own no matter
how large a balance grows; and a withdrawal is never sent automatically
either, a staff member has to approve it first, the same way a weekly
payout batch already required approval before Module 3.

- **Schema.** Four new enums (`PayoutDestination`, `WalletTransactionType`,
  `WalletTransactionSource`, `WalletWithdrawalStatus`), a new
  `InvestorProfile.walletBalance` denormalized total, a new
  `PaymentBatchItem.payoutDestination` (defaults to `BANK`, everything
  existing keeps behaving exactly as before), and two new tables:
  `WalletTransaction` (the ledger, one row per balance change, always
  traceable to a `PaymentTransaction`, a `WalletWithdrawal`, or a funded
  `InvestmentContract`) and `WalletWithdrawal` (an investor's request,
  `PENDING_APPROVAL` until staff act on it). The migration
  (`prisma/migrations/20260831142116_add_wallet_system`) is hand-written
  rather than generated: `npx prisma migrate dev`/`generate` need to
  download Prisma's schema/query engine binaries from
  `binaries.prisma.sh`, which the sandbox this was built in cannot reach
  (a hard 403 from its network policy, not a transient error, confirmed by
  retrying and by checking `@prisma/engines`' own postinstall). Every
  statement in it is purely additive (new types, new nullable/defaulted
  columns, two new tables), written and reviewed by hand against the
  exact conventions the two earlier real migrations already established,
  the same discipline the Module 11 rename migration used, just for a
  different reason. **Before this app will run, apply it and regenerate
  the client from a machine that can reach `binaries.prisma.sh`:**
  `npx prisma migrate deploy` (or `migrate dev` in development), then
  `npx prisma generate`, then re-run `npx prisma db seed` to create the
  three new permission rows below.
- **Bank-or-wallet routing on a payout.** Staff creating a payment batch
  (`/admin/payments/batches/new`) now tick a per-row "Hold" checkbox to
  route that investor's payout into their wallet instead of their bank
  account; nothing defaults to wallet on its own.
  `lib/payments/batch-processor.ts` was refactored so the part of "this
  investor was just paid" that both destinations share (recording the
  `PaymentTransaction`, allocating it, advancing the contract's running
  total, detecting target-achieved) lives in one `recordPayout` helper;
  `applyTransferOutcome` (bank, via Paystack) and the new
  `applyWalletHold` (wallet, no Paystack call at all) both call it, so a
  wallet-held payout counts toward a contract's target exactly the way a
  bank payout always has. The batch detail page shows a Bank/Wallet badge
  per item.
- **`/investor/wallet`.** Balance, full ledger history, and a "Request
  withdrawal" form (blocked until bank details are on file, and while a
  request is already open, so two approvals can never draw against the
  same balance). Also now a stat card on `/investor/dashboard`, since
  seeing the wallet grow at a glance was the actual point of the feature.
- **`/admin/wallet`.** A new hub (same pattern as `/admin/settings`) with
  two sections. **Withdrawal requests** is a maker-checker queue: approve
  debits the ledger immediately and attempts a real Paystack transfer the
  same way a batch item does, reject leaves the balance untouched, and a
  "Mark as paid" fallback exists for confirming a transfer that didn't
  settle automatically, since a bank transfer completing is not something
  this app gets to decide on its own. **Fund a vehicle from wallet** lists
  every investor currently holding a balance, highest first, and lets
  staff convert some or all of it into a brand new contract's principal
  on a specific vehicle, reusing the exact same schedule-generation logic
  `createInvestmentContract` uses (now exported from
  `lib/actions/contracts.ts`) so a wallet-funded contract is laid out
  identically to a normally-funded one.
- **RBAC.** Three new permission keys: `wallet.view`, `wallet.withdrawal.approve`,
  `wallet.funding.manage`. Finance gets view, Approver gets all three,
  matching how those two roles already relate to payment batches.

## Previously delivered (Module 13: password reset, and the last two dead links)

Two unrelated dead ends closed in the same pass, both found by actually
clicking through the app rather than by a planned feature list.

- **Password reset.** "Forgot password?" on `/sign-in` went to `#` and did
  nothing, now it goes to a real `/forgot-password` page that emails a
  Supabase Auth reset link, which lands on `/reset-password` to set a new
  one. Both are public routes (added to `PUBLIC_PATHS` in `proxy.ts`), and
  `/forgot-password` always shows the same "check your email" message
  whether or not that address has an account, so the page itself can't be
  used to find out who has one. `/reset-password` signs the browser back
  out the moment the new password is saved, matching how this app treats
  signing in with your credentials as the only way into the dashboard, a
  session picked up from a reset link isn't meant to double as one.
- **The agent portal's last two dead links.** "My Vehicles" and
  "Remittances" have been sitting in the agent sidebar since the very
  first module, pointing at pages that didn't exist. `/agent/vehicles` is
  the complete list of vehicles assigned to that agent, with driver,
  installment, and investor, not just the dashboard's this-week snapshot.
  `/agent/remittances` is the same idea for payments: full history and an
  all-time total, not just this week's number. `getAgentVehicles` and
  `getAgentRemittances` in `lib/data/agent.ts` are the new queries behind
  them.

## Previously delivered (Module 12: settings panel and a separate admin sign-in)

Two related requests: settings that used to need a code change should be
editable from the admin panel, and the owner-tier admin account should
sign in somewhere separate from everyone else instead of sharing the
"Staff / Agent" tab on the regular sign-in screen.

- **`/admin/settings` is now a real hub**, not a redirect straight to
  roles. It lists every settings screen the signed-in staff member has
  permission to open: roles and permissions, staff and agent accounts,
  and the new contract defaults page below, each hidden entirely for
  someone without the matching permission rather than shown and then
  blocked.
- **`/admin/settings/contract-terms`** makes the per-vehicle-type default
  contract terms (introduced in Module 9 as `VEHICLE_TYPE_DEFAULT_TERMS`,
  a hard-coded constant) editable without touching code. Each vehicle
  type gets a "Custom" or "Built-in default" badge and its own form
  (principal, target payout, installment, term, frequency); saving one
  writes a row to the long-unused `SystemSetting` table
  (`updateVehicleTypeDefaults` in `lib/actions/settings.ts`).
  `getEffectiveVehicleTypeDefaults` (`lib/data/onboarding.ts`) reads that
  override when one exists and falls back to the original constant when
  it doesn't, so `/admin/contracts/new` keeps working exactly as before
  for any vehicle type nobody has customized yet. This is also what
  resolves Module 9's flagged caveat that the car and bike numbers were
  placeholders, they can now be corrected from the app the moment the
  business confirms the real figures, no deploy required. Gated behind
  the existing `settings.manage` permission, already granted to Admin,
  no reseed needed for this module.
- **`/admin-sign-in`** is a separate, plainly-branded sign-in page for
  the one account that holds the system "Admin" role
  (`isPlatformAdmin` in `lib/rbac/check-permission.ts`, true only for a
  role seeded with `isSystem: true`). It deliberately lives outside
  `app/admin/`, as a sibling directory, not `app/admin/sign-in`, because
  anything nested under `app/admin/` inherits that layout's
  `if (!user) redirect("/sign-in")`, which would make a page meant for a
  signed-out visitor permanently unreachable. The regular `/sign-in`
  page's "Staff / Agent" tab now checks the same way after a successful
  sign-in and, if the account turns out to be the Admin account, signs it
  back out and points it at `/admin-sign-in` instead, so day to day staff
  and agent sign-ins never share a screen with the one account that can
  change roles and system-wide settings.

## Previously delivered (Module 11: staff and agent account creation)

The last account type with no in-app creation flow now has one. Every
other account type (investor, self-service or staff-driven) already had
a real screen, staff and agents had to be created directly in the
database or through `prisma/seed-demo.ts`.

- **`/admin/settings/staff`** lists every staff and agent account with
  their type, job title or region, and whichever roles they currently
  hold. **`/admin/settings/staff/new`** creates one: it makes a real
  Supabase Auth account with a generated temporary password (the exact
  same pattern `/admin/investors/new` already used, an email invite would
  depend on Supabase's outgoing email and an allow-listed redirect URL,
  neither of which this app controls), shown once on a confirmation
  screen for staff to relay directly. A role can optionally be assigned
  in the same step, or later from `/admin/settings/roles/[id]`.
- New permission: `staff.manage` (`PERMISSIONS.STAFF_MANAGE`), gating
  this whole screen. **Run `npx prisma db seed` after pulling this**, the
  new permission only exists in code until that seed's upsert loop
  creates its row and grants it to the Admin role, this is safe to run
  any time, nothing about it is destructive.

## Previously delivered (Module 10: investor portal completed)

The investor sidebar has had "My Investments," "Payments," and
"Documents" links since the very first module, all three 404'd until
now, this closes that gap.

- **`/investor/investments`.** Every contract the investor holds, in
  full: principal, target payout, installment amount and frequency, term
  length, start date, and overall contract status, not just the
  dashboard's short summary. `getInvestorInvestments` in
  `lib/data/investor.ts` is the new query behind it.
- **`/investor/payments`.** The complete payment history across every
  contract, with a running total received at the top. The dashboard
  still only previews the most recent 6 rows, this page is the "Full
  history" link it already pointed at.
- **`/investor/documents`.** Shows the same government ID/proof of
  address status already tracked for KYC (`getMyKycDocuments`, reused
  rather than rebuilt), with links back to `/kyc` to upload or replace
  one. It says plainly that documents tied to a specific contract aren't
  available here, because the `Document` model has no reader or writer
  anywhere in the app yet, see `docs/architecture/CURRENT_STATE.md`,
  "Known gaps." This page shows what's real today, not a placeholder
  pretending that part exists.

## Previously delivered (Module 9: vehicle types & agent remittance instructions)

The business asked for this platform to cover more than kekes, a
contract can now be against a keke, a car, or a bike, each with its own
default contract numbers. Agents also got clearer guidance for paying
their weekly remittance through the app.

- **Vehicles, not just Kekes.** The `Keke` model, its table, and every
  route, function, and label built on top of it are renamed to `Vehicle`
  throughout the codebase, with a new `type` field (`VehicleType`: `KEKE`,
  `CAR`, or `BIKE`). This was a full rename, not a cosmetic label change,
  see `docs/architecture/CURRENT_STATE.md` for exactly which command to
  run and why this particular migration needs care (it renames a table
  and several columns, not just adding an enum value).
- **Per-vehicle-type default contract terms.** `/admin/contracts/new`
  pre-fills the principal, target payout, installment, frequency, and
  term based on which vehicle is picked (`lib/vehicle-types.ts`,
  `VEHICLE_TYPE_DEFAULT_TERMS`), and every one of those fields stays
  editable, contract terms were already data per contract, this only
  changes what a staff member sees pre-filled before they touch anything.
  **The keke numbers are the real, locked business rules, the car and
  bike numbers are placeholders and need confirming with the business
  before this is relied on.**
- **Telling vehicle types apart visually.** A new `CarIcon` and `BikeIcon`
  (`components/design-system/vehicle-icons.tsx`) match `KekeIcon`'s style
  so a mixed fleet list still reads as one design, not three unrelated
  icon sets. The app's actual brand mark, `KekeIcon`/`KekeWatermark` in
  the sidebar and the sign in/KYC hero panels, is untouched and stays
  keke-specific regardless of what the fleet contains, that is
  intentional, not an oversight.
- **Agent remittance instructions.** The agent dashboard's Paystack
  collection account now has a copy-to-clipboard button next to the
  account number and three numbered steps explaining what to do with it.
  The agent still pays through their own bank app or USSD, this was a
  deliberate scope decision, not a placeholder for something bigger, real
  in-app checkout (the agent entering a card or account inside this app
  and the app itself initiating the debit) would be a materially bigger
  integration and was not what was asked for here.

## Previously delivered (Module 8: notifications, RBAC settings, investor payout details)

Module 8 closes the two gaps flagged at the end of Module 7 and adds the
notification channels the business asked for.

- **Investor payout details.** `/investor/payout-details` lets an
  investor enter the bank account their weekly payouts go to. The account
  number and bank are resolved against Paystack's bank verification API
  (`lib/payments/provider.ts`, `resolveBankAccount`) before saving, the
  account name that comes back from Paystack is what gets stored, never
  whatever the investor typed, so a payout can never be pointed at a
  typo'd account. Saving new details clears any existing Paystack
  transfer recipient code, so the next payout batch creates a fresh one
  for the new account rather than silently continuing to pay the old one.
- **Roles & permissions settings.** `/admin/settings/roles` (the
  previously dead "Settings" link) lists every role with its permission
  and member counts. `/admin/settings/roles/[id]` is a permission matrix
  (grant or revoke one permission at a time) plus who currently holds the
  role, with an "assign" picker limited to staff and agent accounts.
  `/admin/settings/roles/new` creates a role, which starts with zero
  permissions. The seeded "Admin" role is a system role: its permission
  set can't be edited and it can't be deleted, and its last remaining
  member can't be removed, so there's never a path to an app nobody can
  administer.
- **Email and SMS notifications.** Investors are now notified by email
  (Resend) and SMS (Termii) when a payout lands, when an ownership
  transfer completes, and when their KYC status changes. See
  `docs/architecture/CURRENT_STATE.md`, "Notifications," for how the two
  providers are wired and which environment variables they need. This
  needs `RESEND_API_KEY`/`RESEND_FROM_EMAIL` and
  `TERMII_API_KEY`/`TERMII_SENDER_ID` set to actually send, without them a
  notification attempt is recorded as `FAILED` rather than silently
  skipped.
- Added `SMS` to the `NotificationChannel` enum in `prisma/schema.prisma`,
  **run `npx prisma migrate dev` after pulling this** before starting the
  app.

## Previously delivered (Module 7: KYC documents & self-service sign up)

Module 7 closes the last two gaps in onboarding: investors can create
their own account, and the document upload boxes on `/kyc` are real.

- **Self-service sign up.** `/sign-up` is a public page, no staff
  involved. It creates the Supabase Auth account directly with the
  password the investor chose (`lib/actions/auth.ts`, `signUpInvestor`),
  the same reasoning as staff-created investors: this sidesteps
  depending on Supabase's outgoing email and a redirect URL allow-list.
  If creating the Postgres side fails after the Auth user already
  exists, the Auth user is rolled back so retrying the same email
  doesn't hit "already exists" against a half-created account. Once it
  succeeds, the page itself signs the investor straight in with
  `supabase.auth.signInWithPassword` (mirroring exactly what `/sign-in`
  does) and sends them to `/kyc` to start verification. Staff-created
  investors from `/admin/investors/new` still work exactly as before,
  this is just a second door in.
- **KYC document upload.** The government ID and proof of address boxes
  on `/kyc` are wired to a real Server Action
  (`lib/actions/kyc.ts`, `uploadKycDocument`) that uploads the file to a
  private Supabase Storage bucket and records a `KycDocument` row.
  Re-uploading a document type replaces whatever was there before (both
  the old file and its row), so there is always at most one document per
  type per investor rather than a growing pile of retries. **This needs
  one manual one-time step**: create a **private** Storage bucket named
  exactly `kyc-documents` in your Supabase project (Storage -> New
  bucket), Storage buckets are a project setting, not something a
  migration or seed script can create for you. Until that bucket exists,
  the first upload attempt fails with an error that says so.
- **Staff KYC review.** `/admin/kyc` lists every investor with something
  awaiting a decision. `/admin/kyc/[investorId]` shows their BVN/NIN and
  every document with a 10 minute signed URL to actually view a file
  sitting in a private bucket (`lib/data/kyc.ts`), lets staff approve or
  reject each document individually (`reviewKycDocument`), and makes the
  overall call on the investor (`reviewInvestorKyc`), separate from any
  one document, since that overall status is what actually unlocks their
  first contract.

## Previously delivered (Module 6: investment & Keke detail pages)

Module 6 adds the drill-in views that were missing from every list built
so far, contracts and Kekes only existed as rows until now.

- `/admin/contracts/[id]` shows one investment contract in full: a
  progress bar toward the target payout amount (`lib/data/contracts.ts`),
  every term (principal, installment, frequency, term length), and the
  complete payment schedule with each entry's due date, expected amount,
  amount actually paid, and status. If the contract has reached its
  target, a banner links straight to its ownership transfer.
- `/admin/fleet/[id]` shows one Keke in full: its fleet record (frame and
  plate number, location, assigned agent), every contract ever written
  against it, its complete driver assignment history, and its
  maintenance history, each pulled from the relations that already
  existed on the `Keke` model but had nowhere to be shown.
- These are now reachable from where you'd expect: clicking a Keke card
  on `/admin/fleet` opens its detail page, clicking an investor's name on
  a Keke's contract list or the ownership transfer screen opens the
  contract, and the dashboard's "Investors due today" rows now link to
  their contract instead of being static text.

## Previously delivered (Module 5: ownership transfers)

Module 5 adds the missing other half of Module 3's automatic detection:
somewhere to actually act on a Keke that's ready to change hands.

- `/admin/transfers` lists every `OwnershipTransfer` record, most recent
  first, each one shows how much the investor has been paid against
  their target and its current status.
- `/admin/transfers/[id]` is the workflow itself: the same maker-checker
  discipline as payment batches. A transfer starts as "awaiting
  verification" the moment it's created. One staff member with
  `transfer.verify` confirms the numbers and verifies it
  (`lib/actions/transfers.ts`, `verifyOwnershipTransfer`), which moves the
  contract to `TRANSFER_IN_PROGRESS`. A **different** staff member with
  `transfer.approve` then approves it, which is the final step,
  `approveOwnershipTransfer` marks the transfer `COMPLETED`, stamps
  `approvedAt`/`completedAt` together, and moves the contract to
  `COMPLETED`, that is what "the Keke has changed hands" means in this
  system. `assertDifferentActor` enforces the different-person rule
  server-side, exactly like batch approval.
- Either stage can be rejected with an optional note
  (`rejectOwnershipTransfer`), which doesn't delete anything, it sends the
  transfer back to "awaiting verification" so it can be corrected and
  re-verified, since the underlying trigger (the numbers crossing the
  target) doesn't un-happen just because a mistake was caught.
- The "Needs attention" card on the operations dashboard already counted
  contracts at target, that line is now a real link straight into this
  list instead of just a number.

## Previously delivered (Module 4: fleet & contract onboarding)

Module 1 built the scaffold, design system, and Paystack/RBAC code on
sample data. Module 2 replaced the sample data with real Supabase Auth
sessions and real Prisma queries. Module 3 added the actual money
movement to investors. Module 4 adds the forms to actually create the
things Modules 2 and 3 pay out on:

- `/admin/investors` lists every investor, with their KYC status and
  contract counts. "Add investor" (`lib/actions/investors.ts`) creates a
  real Supabase Auth account for them directly with a generated
  temporary password, shown once on `/admin/investors/new/success`, staff
  relay it to the investor. This avoids depending on Supabase's outgoing
  email and a redirect URL allow-list, neither of which is set up in
  local development.
- `/admin/fleet/new` is the real "Add new Keke" form, replacing the
  disabled placeholder button. Assigning an agent while creating it marks
  the Keke `PENDING_ONBOARDING` instead of `UNASSIGNED`.
- `/admin/contracts/new` creates a real `InvestmentContract` between an
  investor and an available Keke (one without an existing active
  contract), and generates the entire payment schedule up front
  (`lib/actions/contracts.ts`, `generateScheduleDates`, supports weekly,
  biweekly, and monthly). Every term (principal, target payout,
  installment, term length, frequency) defaults to the standard
  agreement but is editable per contract, none of it is a code constant.
  Creating a contract marks the Keke `ACTIVE`.

## Previously delivered (Module 3: payment batches)

- `/admin/payments/batches` lists every batch. `/admin/payments/batches/new`
  shows every investor currently due or partially paid (excluding anyone
  already in an open batch) with a checkbox to include or exclude them,
  and creates a real `PaymentBatch` in `PENDING_APPROVAL`.
- Approving a batch (`lib/actions/payments.ts`) creates a Paystack
  transfer recipient for any investor who doesn't have one yet, then
  calls Paystack's real transfer API for each item. This needs
  `PAYSTACK_SECRET_KEY` set, without it the transfer call fails and the
  item is marked `FAILED` with that reason, nothing is faked.
- Maker-checker is real and server-enforced, not just hidden in the UI:
  `assertDifferentActor` in `lib/rbac/check-permission.ts` throws if the
  same staff member who created a batch tries to approve or reject it,
  even if their role holds both permissions. This is why the demo seed
  now includes a fourth account, see below.
- The moment an investor's contract reaches its target payout amount,
  the contract flips to `TARGET_ACHIEVED` and an `OwnershipTransfer`
  record is created automatically (`lib/payments/batch-processor.ts`).
  The verify/approve UI for actually completing that transfer is still
  the next module, this only detects and records that it's time.
- The Paystack webhook and the approve action now share one function
  (`applyTransferOutcome`) for writing the ledger, so a transfer that
  resolves synchronously and one confirmed later by webhook can never
  double-process the same payment.

- Sign in (`/sign-in`), the investor dashboard (`/investor/dashboard`),
  the operations dashboard (`/admin/dashboard`), the fleet list
  (`/admin/fleet`), the agent dashboard (`/agent/dashboard`), and KYC
  onboarding (`/kyc`) all now read from the database through the
  functions in `lib/data/*.ts`, not from `lib/mock-data.ts`. Every one of
  them handles the empty state correctly (a fresh database legitimately
  shows zeros and "nothing yet" messages, this is not a bug).
- Every portal layout resolves the real signed in user (`lib/auth`) and
  redirects to `/sign-in` if there isn't one, and there is now a working
  sign out button in the sidebar.
- The KYC page's BVN and NIN fields are wired to a real Server Action
  (`app/kyc/actions.ts`) that saves to `InvestorProfile` and moves it to
  `PENDING_REVIEW`. Document upload (government ID, proof of address) is
  not wired up yet, the page says so rather than pretending.
- `prisma/seed-demo.ts` creates three real, sign-in-able demo accounts
  (investor, admin, agent) plus a sample Keke, contract, payment
  schedule, and payment history, so every dashboard has something real
  to show. Run it with `npm run db:seed:demo`, see "Trying it with demo
  data" below for the login details.

**Still not built**: see `docs/architecture/CURRENT_STATE.md`, "Known
gaps," for the current list, it's kept there instead of here so there's
exactly one place that can go stale instead of two.

## Trying it with demo data

After your database is migrated and seeded (see below), run:

```bash
npm run db:seed:demo
```

This creates a full set of real Supabase Auth users, all with the
password `Password123!` (expanded substantially in Module 23, see its
README entry above for the full reasoning behind what's included and
what's deliberately not):

- `investor.demo@ultimate.africa`, verified, a Keke contract partway
  through its schedule, a wallet balance, and one pending withdrawal
  request (try cancelling it from `/investor/wallet`, the Module 23
  button)
- `investor4.demo@ultimate.africa`, verified, a car contract that just
  started (so two investors are ever due for a payment on the same day)
  and a bike contract already fully paid out and transferred, see
  `/admin/transfers`
- `investor2.demo@ultimate.africa` (KYC pending review) and
  `investor3.demo@ultimate.africa` (KYC rejected), for `/admin/kyc`
- `admin.demo@ultimate.africa`, the system Admin account, **sign in at
  `/admin-sign-in`, not `/sign-in`**, see "RBAC: roles and permissions" in
  `docs/architecture/CURRENT_STATE.md`
- `companyadmin.demo@ultimate.africa`, the new Module 23 "Company Admin"
  role, day-to-day company administration without staff/role/settings
  access, signs in normally at `/sign-in`
- `approver.demo@ultimate.africa`, a separate staff account that can
  approve or reject a batch someone else created, use this one to
  actually test the pay flow, the account that created a batch can never
  approve its own
- `agent.demo@ultimate.africa` (Kano) and `agent2.demo@ultimate.africa`
  (Lagos)
- `driver1.demo@ultimate.africa` and `driver2.demo@ultimate.africa`, two
  of the five seeded drivers, the two with a real Module 22 app account;
  the other three (Yakubu Danladi, Emeka Okafor, and the original Ibrahim
  Sule) deliberately don't have one, so `/admin/drivers` shows both kinds

Sign in at `/sign-in` (Investor / Staff & Agent tabs) for everyone except
`admin.demo`, which is the one account this app deliberately keeps on a
separate door. This needs `SUPABASE_SERVICE_ROLE_KEY` set in `.env`, it
creates the auth users through Supabase's admin API. Never run this
against a production project, it creates accounts with a publicly known
password.

To actually test a payout: sign in as `companyadmin.demo` (or
`admin.demo`), go to Payments, click New batch, create one from either
investor who's due today, then sign out and sign back in as
`approver.demo` to approve it. Without a real `PAYSTACK_SECRET_KEY` in
`.env`, approval will run and the item will come back `FAILED` (Paystack
rejects the request), that's expected, add a real test-mode secret key to
see an actual transfer go through.

## Running this locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`. As of Module 2, the portal pages
   need real `DATABASE_URL`/`DIRECT_URL` and Supabase values to do
   anything useful, they query the database and require a signed in
   user. Without Supabase configured, `proxy.ts` skips auth entirely
   (see the comment in that file), but the pages will still error
   without a working database connection.

3. Once `DATABASE_URL` and `DIRECT_URL` are set (see "Testing against a
   local Postgres database" below for the fastest path), generate the
   Prisma client, create the tables, and seed the RBAC roles:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

   **On Windows, `prisma` on its own is not a recognized command** (you'll
   see `CommandNotFoundException` in PowerShell), since it's a project
   devDependency, not something installed globally on your machine. Either
   keep the `npx` prefix shown above on every command, or use the
   equivalent `npm run` scripts this project ships instead, which work
   the same on every OS:

   ```bash
   npm run db:generate
   npm run db:migrate:dev
   npm run db:seed
   ```

   Optionally, once you're on a real Supabase project (this step needs
   `SUPABASE_SERVICE_ROLE_KEY`, it won't work against local Postgres),
   also run `npm run db:seed:demo` to get three sign-in-able demo
   accounts with sample data, see "Trying it with demo data" above.

   To check whether your migrations actually applied, at any point, run:

   ```bash
   npx prisma migrate status
   ```

   `Database schema is up to date!` means every migration in
   `prisma/migrations` (the wallet system, the withdrawal-cancel enum,
   everything) is applied for real. Anything else, paste the full output
   somewhere it can be read against what's expected.

4. Create your first Admin account (Module 25). `npx prisma db seed`
   creates the fixed system roles (Admin included) but no actual account
   to hold one, this is the real chicken-and-egg step. Set
   `SETUP_BOOTSTRAP_KEY` in `.env.local` to any long random string you
   make up, start the dev server (step 6 below), then visit
   `/setup` and fill in the form. This page permanently disables itself
   the moment it succeeds, safe to leave the environment variable set
   afterward. Every other staff, agent, or driver account gets created
   from inside the app after this, at `/admin/settings/staff`.

5. On a real Supabase project, create two private Storage buckets:
   `kyc-documents` and `documents` (Storage -> New bucket in the
   dashboard). Nothing in this codebase can create either for you,
   Storage buckets are a project-level setting, not a database table a
   migration can touch. KYC document upload on `/kyc` needs the first,
   attaching a file to a contract or vehicle from `/admin/contracts/[id]`
   or `/admin/fleet/[id]` needs the second, both fail with a clear error
   until their bucket exists, everything else works without them.

6. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open `http://localhost:3000`.

## Running the automated test suite

```bash
npm test          # run once
npm run test:watch  # re-run on file changes
```

This runs Vitest against every `**/*.test.ts` file (see Module 19 above
for what is and is not covered, and why). It needs no database connection
and no environment variables, since it either tests pure functions
directly or mocks the Prisma client entirely, so it's safe to run before
`.env.local` even exists. It is not a substitute for the integration
testing described in the next section, running real Prisma migrations and
queries against a real Postgres database, since a mocked Prisma client
can't catch a wrong column name, a bad migration, or a query that's
syntactically fine but wrong against the real schema.

## Testing against a local Postgres database

You do not need a Supabase project to start testing the data model and
business logic, a Postgres server already running on your own machine
works. This does not give you working sign in yet, since that depends on
Supabase Auth specifically, but it lets Prisma create every table, the
seed script populate real roles and permissions, and any page that gets
wired to a real query (see the project README's module notes) actually
read and write real rows.

1. Make sure your local Postgres server is running, then create a
   database for this project. Using `psql` or any GUI you already have:

   ```sql
   CREATE DATABASE keke_platform;
   ```

2. In `.env.local`, set both `DATABASE_URL` and `DIRECT_URL` to the same
   local connection string, there is no connection pooler to route around
   on your own machine:

   ```
   DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/keke_platform
   DIRECT_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/keke_platform
   ```

   Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with whatever you set up
   when you installed Postgres (commonly the user is `postgres`). If your
   server runs on a different port, change `5432` to match.

3. Create the tables and seed the RBAC roles (or `npm run db:migrate:dev`
   and `npm run db:seed`, see the Windows note in "Running this locally"
   above, the bare `prisma` command below only works if you drop the
   `npx`):

   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

4. Confirm it worked by opening Prisma's own data browser:

   ```bash
   npx prisma studio
   ```

   (or `npm run db:studio`)

   You should see the `roles` and `permissions` tables populated (Admin,
   Finance, Approver, Operations, ComplianceReviewer, Investor, Agent,
   Driver) and every other table created and empty, ready for real data.

Moving this same setup to Supabase later is just swapping the two
connection strings in `.env.local`, per the Supabase section in
`.env.example`, and re-running `npx prisma migrate deploy` (or
`npm run db:migrate`) against it. Nothing about the schema or the seed
script changes.

## Project layout

```
app/                     Next.js routes (pages, layouts, API route handlers)
  api/webhooks/paystack/  The Paystack webhook endpoint
  sign-in/                Public sign in screen
  setup/                  One-time first Admin account bootstrap, Module 25
  change-password/        Forced/self-service password change, Module 26
  kyc/                    Investor identity verification onboarding
  investor/               Investor portal (sidebar shell + dashboard)
  admin/                  Operations console (sidebar shell + dashboard, fleet,
                           payments/batches list, new batch, batch detail)
  agent/                  Agent portal (dashboard, vehicles, remittances)
  driver/                 Driver portal (dashboard, deposits), Module 24
components/
  ui/                     Hand-built shadcn-style primitives (button, card, table, ...)
  design-system/          The shared Keke brand icon/watermark (kept keke-specific
                           on purpose), plus generic car/bike/keke vehicle-type icons
  layout/                 The reusable sidebar + shell used by every portal
  fleet/                  Fleet-specific components (the vehicle status card, still
                           in a file named keke-card.tsx, see the comment in it)
lib/
  prisma.ts               Shared Prisma Client instance
  data/                   Real Prisma queries each page reads from (Module 2+)
  actions/                Server Actions that mutate data
  mock-data.ts            Old sample data, unused now, kept as a shape reference
  supabase/                Browser, server, and service-role Supabase clients
  auth/                    Resolves the signed in user plus their permissions
  rbac/                    Permission catalog and the database-backed check
  payments/                PaymentProvider interface, the Paystack implementation,
                            the webhook event handler, and batch-processor.ts
                            (the shared, idempotent ledger-writing function)
  notifications/          EmailProvider/SmsProvider interfaces, the Resend and
                            Termii implementations, and sendNotification(), the
                            one function every notification actually goes through
prisma/schema.prisma      The full data model
prisma/seed-demo.ts       Creates the four sign-in-able demo accounts
docs/architecture/
  README.md               Why things are built the way they are (stable)
  CURRENT_STATE.md         What's built and what isn't, as of today (kept current)
```

## Why some things are built the way they are

A few choices came directly out of planning discussion and are worth
knowing before changing them:

- **One Next.js app, no separate backend service.** Route Handlers and
  Server Actions are the backend. See `docs/architecture` for the reasoning
  if this looks unfamiliar coming from a separate frontend/backend setup.
- **Prisma talks to Supabase Postgres through two connection strings**,
  a pooled one for the app and a direct one for migrations, because
  serverless functions need pooling and Prisma's migration engine does
  not work well through a pooler.
- **Contract terms are data, not code.** `InvestmentContract` stores
  `principalAmount`, `installmentAmount`, `paymentFrequency`, `termMonths`,
  and `targetPayoutAmount` per contract so each investor's actual
  agreement can differ without a code change.
- **The webhook always stores the raw Paystack event first**, in
  `ProviderTransaction`, before interpreting it. The unique constraint on
  `providerRef` is what makes a retried webhook delivery a no-op instead
  of a double-processed payment.
- **BVN and NIN are collected but not automatically verified** in this
  phase, per the cost discussion, they are stored for manual staff review.
