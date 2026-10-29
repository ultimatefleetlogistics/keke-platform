# Current state (read this first)

This file is the fast way to get oriented in this codebase from zero,
whether that is a person coming back after a break or a fresh AI session
that has never seen this project before. It describes what the app
actually does today, not the plan or the history. `README.md` at the
project root keeps the module by module changelog (how we got here); the
rest of `docs/architecture/` explains why certain things were built the
way they were. This file is the snapshot: what exists, right now, and
what still doesn't.

Keep this file up to date. Whenever a module is finished, update the
relevant section below in the same change, the same way `README.md`'s
changelog gets a new entry. A stale snapshot is worse than no snapshot,
it actively misleads whoever reads it next.

## What this app is

A real, live platform for running vehicle investments in Nigeria: keke
(tricycle), car, or bike, tracked as `VehicleType` on the `Vehicle` model.
An investor puts up the money for a vehicle, the platform runs it (through
an agent and driver), and pays the investor back weekly out of what the
vehicle earns until the investor's target payout is reached, at which
point ownership of the vehicle moves to the manager. Everything in this
codebase serves that one workflow, for any of the three vehicle types.

## Locked business rules

These numbers and rules came directly from the person running this
business and should not be changed without them explicitly asking. They
are specific to the KEKE vehicle type, the original and still primary
business line:

- Standard contract principal (keke): NGN 3,850,000 (editable per
  contract, this is only the default that pre-fills the form)
- Maximum contract term: 25 months
- Standard weekly installment (keke): NGN 65,000 (also editable per
  contract)
- Target payout amount that triggers ownership transfer (keke): NGN
  6,500,000 (also editable per contract, see
  `InvestmentContract.targetPayoutAmount`)
- Payments are two directional and both automated through Paystack:
  agents and drivers collect into a Paystack Dedicated Virtual Account,
  the manager pays investors out through Paystack Transfers
- BVN and NIN are collected during KYC but never auto-verified, a human
  reviews them. This was a deliberate cost decision, not a missing
  feature, see `docs/architecture/README.md`
- Web only, one Next.js app, no separate backend service
- The investor wallet (Module 14) is a ledger figure only, never a real
  money-holding account, the real cash always stays in the company's
  bank account (`InvestorProfile.walletBalance`, kept in sync with the
  `WalletTransaction` rows that are the actual source of truth)
- Converting a wallet balance into a new vehicle's contract is always a
  staff decision, made explicitly at `/admin/wallet/funding/[investorId]`,
  never triggered automatically by the system just because a balance
  grows large enough
- A wallet withdrawal is never sent automatically either, a staff member
  has to approve it first at `/admin/wallet/withdrawals`, the same
  approval-before-transfer shape a weekly payout batch already has

The CAR and BIKE default contract terms in `lib/vehicle-types.ts`
(`VEHICLE_TYPE_DEFAULT_TERMS`) are placeholders written to unblock the
UI, not confirmed by the business. Replace them with real numbers before
relying on them, they are flagged with a comment in that file.

## Tech stack

Next.js 16 (App Router, TypeScript, Turbopack), React 19, Tailwind v4.
Prisma ORM against Supabase Postgres. Supabase Auth for sign in, Supabase
Storage (two private buckets: `kyc-documents` for identity verification,
`documents` for contract/vehicle files, both created by hand in the
Supabase dashboard, neither exists by migration or seed). Paystack for both collection
(Dedicated Virtual Accounts) and payout (Transfers). Resend for
transactional email, Termii for SMS. Sentry for error tracking, off by
default until `NEXT_PUBLIC_SENTRY_DSN` is set, see the Error tracking
section below. Vitest for the automated test suite, see the Testing
section below.

Design system: Plus Jakarta Sans, keke gold `#C9820A` as the accent color,
charcoal `#1F1A12` as the dark text/ink color, and a fixed status color
set used everywhere a badge or banner needs one: good (green), warn
(amber), bad (red), pending (a distinct amber/orange from warn), and
neutral/accent for everything else. `components/ui/*` are hand-built
shadcn-style primitives, not a third-party component library. Never use
an em dash anywhere in this codebase, in code comments, in UI copy, or in
this documentation, it is a hard house rule.

## How to get this running

Full setup steps (installing dependencies, environment variables,
migrating, seeding, running against local Postgres vs. Supabase) live in
`README.md` at the project root, not duplicated here to avoid the two
drifting apart. The short version: copy `.env.example` to `.env.local`,
fill in Supabase and Paystack values, run `npx prisma generate && npx
prisma migrate dev && npx prisma db seed`, then `npm run dev`.

**After pulling any change that touches `prisma/schema.prisma`** (adding
the `SMS` notification channel in this session's work is one example),
run `npx prisma migrate dev` again before starting the app. Skipping this
is the single most common cause of confusing runtime errors that look
like application bugs but are actually just an out of date generated
Prisma Client.

**The Keke to Vehicle rename was the riskiest migration this app has run
so far**, and it is a worked example worth reading if a similar rename is
ever needed again. `npx prisma migrate dev` did exactly what this warning
predicted: instead of detecting a rename, it proposed dropping the entire
`kekes` table and every `kekeId` column, which would have silently lost
the fleet and every contract, driver assignment, maintenance record,
ownership transfer, and document linked to it. The fix was
`npx prisma migrate dev --create-only`, which writes the migration file
without touching the database, then hand-editing that file to use
`ALTER TABLE ... RENAME` and `ALTER TYPE ... RENAME` statements instead,
which Postgres executes in place without moving any rows. The corrected,
applied version is `prisma/migrations/20260829144258_rename_keke_to_vehicle/migration.sql`,
worth reading directly as a template: any future rename of a table or
column that already has real rows in it should go through
`--create-only` and the same manual review, never a bare `migrate dev`
against production data.

## Data model, grouped

Everything lives in `prisma/schema.prisma`, this is a map of it, not a
replacement for reading the actual file when precision matters.

**Identity and access**: `User` (one row per Supabase Auth account, always
has exactly one of the four profile relations below), `InvestorProfile`,
`StaffProfile`, `Agent`, `Driver`, `Role`, `Permission`, `RolePermission`,
`RoleAssignment`.

**KYC**: `KycDocument` (one row per document type per investor, a
re-upload replaces the previous row rather than accumulating).

**Fleet**: `Vehicle` (has a `type` field, `VehicleType`: `KEKE`, `CAR`, or
`BIKE`; the table is still named `vehicles` at the database level after
the rename from the original `Keke` model), `DriverAssignment` (history of
which driver has run which vehicle), `MaintenanceRecord`.

**Contracts and money**: `InvestmentContract`, `PaymentScheduleEntry` (the
generated weekly/biweekly/monthly schedule for a contract),
`ProviderTransaction` (the raw, unmodified record of every Paystack
webhook event, written before anything is interpreted),
`PaymentTransaction` (an interpreted, allocated payment, inbound or
outbound), `PaymentAllocation` (links a `PaymentTransaction` to the
specific `PaymentScheduleEntry` it paid down), `PaymentBatch`,
`PaymentBatchItem` (now carries `payoutDestination`, `BANK` or `WALLET`),
`PaymentBatchApproval`.

**Wallet** (Module 14): `InvestorProfile.walletBalance`, a denormalized
running total, always equal to the sum of that investor's
`WalletTransaction` rows, this is a ledger figure only, not a real
money-holding account, see "Locked business rules" below.
`WalletTransaction` is one row per balance change (`CREDIT` or `DEBIT`,
with a `source`: `PAYOUT_HELD`, `WITHDRAWAL`, `VEHICLE_FUNDING`, or
`MANUAL_ADJUSTMENT`), each optionally linked back to whichever record
caused it, the `PaymentTransaction` it mirrors, the `WalletWithdrawal` it
settles, or the `InvestmentContract` it funded, so every wallet entry is
traceable to a real underlying event. `WalletWithdrawal` is an investor's
request to move wallet balance to their bank account, starting
`PENDING_APPROVAL`, never acted on automatically.

**Ownership transfer**: `OwnershipTransfer`, one row per contract that has
reached its target, tracking the verify then approve workflow.

**Other**: `Document` (a general document model, one row per file attached
to a contract and/or a vehicle, `visibility` decides whether an investor
can ever see it, `PRIVATE_OWNER` or `STAFF_ONLY`, see the Documents
section below), `AuditLog` (one row per staff decision this app already
gates behind a permission, see the Audit log section below),
`Notification` (every attempted email/SMS send, see the Notifications
section below), `SystemSetting` (a generic key/value settings table, now
used to store an admin's override of a vehicle type's default contract
terms, one row per type, see `/admin/settings/contract-terms` below,
falls back to the hard-coded default in `lib/vehicle-types.ts` when no
override row exists).

## Every route, by portal

**Public**: `/sign-in` (one shared page for every non-Admin account,
redirects the Admin account back out if it tries to sign in here, see
`/admin-sign-in` below; round nine removed the "Investor" / "Staff /
Agent / Driver" tabs this page used to have, they never actually gated
anything, real routing has always come from resolving the signed-in
account's actual profile after the fact, not a UI tab picked in advance,
see the round nine entry below and the Module 24 bug fix in Known gaps
for the full history; routes to `/admin/dashboard`,
`/agent/dashboard`, `/driver/dashboard`, or `/investor/dashboard`
depending on which profile the account actually has,
`resolvePortalDestination` in `lib/actions/auth.ts`), `/sign-up` (creates a real Supabase Auth account
directly with the password the investor chose, then signs them in and
sends them to `/kyc`), `/forgot-password` (emails a Supabase Auth reset
link, always shows the same confirmation regardless of whether that email
has an account) and `/reset-password` (where that link lands, sets a new
password then signs the browser back out so signing in with it is still
the only way in). **This needs one manual step in the Supabase
dashboard**: add this app's origin plus `/reset-password` (for example
`http://localhost:3000/reset-password` locally, and the real domain once
deployed) to Authentication &gt; URL Configuration &gt; Redirect URLs, or
Supabase will refuse to redirect there and the emailed link won't work.
Since Module 30, both `/sign-in` and `/admin-sign-in` hold at a 6-digit
code screen after a successful password if the signing-in account has
two-factor authentication turned on, see "Account security" above.

**`/setup`** (Module 25): one-time bootstrap for a brand new deployment's
very first Admin account, since every other account-creation flow needs a
signed-in staff member holding a permission nobody has yet on a fresh
database. Documented in README.md's "Running this locally", and linked
in small print at the bottom of `/admin-sign-in` for whoever is standing
up a new deployment. Gated by `SETUP_BOOTSTRAP_KEY` (an environment
variable, unset means this
page stays disabled) plus a database-wide zero-staff-accounts check, see
`bootstrapFirstAdmin` in `lib/actions/auth.ts` for the full reasoning and
its one disclosed edge case (a same-instant double-submit race).

**`/admin-sign-in`**: a separate sign-in page for the platform owner,
deliberately not nested under `app/admin/` (see the comment at the top of
that file for why: nesting it there would put it behind
`app/admin/layout.tsx`'s own sign-in redirect, making it permanently
unreachable). Same Supabase Auth password sign-in as `/sign-in`,
`verifyAdminAccess` in `lib/actions/auth.ts` checks afterward that the
account holds the system `Admin` role (`isPlatformAdmin` in
`lib/rbac/check-permission.ts`) and signs it back out if not. This is a
UX and mental-model separation, not a second authentication system, both
pages call the exact same Supabase Auth.

**`/kyc`** (any signed in investor): BVN/NIN entry and government
ID/proof of address upload. Shows status badges once a document exists.

**`/change-password`** (Module 26, any signed in account of any kind):
forced for anyone still on a temporary password, reachable voluntarily
any other time from `AppShell`. See "Account security" below.

**Investor portal** (`app/investor/`, requires an `InvestorProfile`):
`/investor/dashboard` (their vehicles, contract progress, an 8-week
payouts-realized trend chart added in Module 20, a 6-row payment
preview), `/investor/investments` (every contract in full: principal,
target, installment, frequency, term length, start date, and status, not
just the dashboard's summary), `/investor/payments` (the complete payment
history, no row limit, plus a running total received; Module 40 added a
filter bar above the table, five preset range chips plus a native
`<input type="date">` range, both plain GET params, see the Module 40
README entry), `/investor/documents`
(KYC document status and re-upload shortcuts, reusing the same data `/kyc`
shows, plus a "Contract documents" list of every `Document` staff marked
`PRIVATE_OWNER` on one of their contracts, each a "View" link to a
short-lived signed URL; reached through `/investor/settings` since
Module 44, not its own sidebar item, see below), `/investor/payout-details`
(Module 26 gave this two sections: the investor's own standing choice for
where a payout lands, bank or wallet, applied automatically to every
batch they're included in going forward; and the bank account itself,
resolved against Paystack's bank verification API before saving so it
can never be pointed at an account that doesn't exist; also reached
through `/investor/settings` since Module 44, not its own sidebar item),
`/investor/wallet` (Module 14: balance,
full ledger history, and a request-withdrawal form, gated behind having
bank details on file and having no other request already in flight),
`/investor/settings` (Module 30, two-factor authentication, named
`/investor/security` at the time, renamed in round eleven; Module 40
added a "Phone number" card above it, calling a new `updateOwnPhone`
Server Action, `lib/actions/auth.ts`, plus a "Password" card that just
links out to the already-existing `/change-password`, see "Account
security" above; round twelve rebuilt the whole page around
`SettingsGroup`/`SettingsRow`, "Personal data" (Full name, Phone
number, Email) and "Security" (Password, a two-factor authentication
row with a real `ToggleSwitch`), see "Account security" above for the
full write-up; Module 44 added a "Payments" section between the two,
with two more navigate-away rows, "Payout details" and "Documents",
moved in from their own top-level sidebar items, see "Investor Settings
hub (Module 44)" below).

**Agent portal**: `/agent/dashboard` (a read-only view of the agent's
assigned vehicles and drivers this week, their Paystack collection
account with a copy-to-clipboard button and step-by-step instructions for
sending a remittance to it, and an 8-week remittances-collected trend
chart added in Module 20), `/agent/vehicles` (every vehicle assigned to
them, in full, not just this week's snapshot, with driver, installment
amount, and investor), `/agent/remittances` (their complete remittance
history and an all-time total, not just this week's number),
`/agent/settings` (Module 30, two-factor authentication, named
`/agent/security` at the time, renamed in round eleven; rebuilt around
`SettingsGroup`/`SettingsRow` in round twelve, same shape as
`/investor/settings` above). The agent still pays through their own
bank app or USSD, there is no in-app checkout, see "Known gaps."

**Driver portal** (`app/driver/`, Module 24): `/driver/dashboard` (their
Paystack collection account with the same copy-to-clipboard treatment the
agent portal uses, their current vehicle assignment, an 8-week
deposits-received trend chart, and a short recent-deposits table) and
`/driver/deposits` (the complete history behind that table, plus an
all-time total, mirroring `/agent/remittances`'s shape exactly),
`/driver/settings` (Module 30, two-factor authentication, named
`/driver/security` at the time, renamed in round eleven; rebuilt
around `SettingsGroup`/`SettingsRow` in round twelve, same shape as
`/investor/settings` above). This is deliberately narrower than the
agent portal: a driver has exactly one
current vehicle, not a fleet, so there's no driver equivalent of
`/agent/vehicles`. This closes the gap Module 22 opened: every driver has
had a real, trackable Supabase Auth account since then, but nothing to
actually sign into existed until now, see the Known gaps bullet that
flagged this, since removed.

**Admin/operations console** (`app/admin/`, gated per page by specific
permissions, see the RBAC section below): `/admin/dashboard`,
`/admin/investors`, `/admin/investors/new` (Module 30 added an optional
bank account section here too, resolved against Paystack before the
account is created, see "Investor bank details" below, previously bank
entry only existed on the edit page below, after the account already
existed), and `/admin/investors/[id]`
(Module 27, edit an existing investor's name/email/phone/payout
destination; Module 28 added a second card on the same page for entering
or updating their bank account, resolved against Paystack the same way
`/investor/payout-details` resolves the investor's own, gated by the same
`investors.manage` permission; Module 30 added a third "Account access"
card, generate a new temporary password, same permission), `/admin/fleet`,
`/admin/fleet/new`, and `/admin/fleet/[id]`, `/admin/drivers`,
`/admin/drivers/new`, `/admin/drivers/new/success`, and
`/admin/drivers/[id]` (Module 27, edit an existing driver, including
which agent they report to; Module 30 added an "Account access" card for
resetting their password, only shown when `driver.hasAppAccess`) (Module 21, real
Supabase Auth account for every driver as of Module 22, see below; gated
by `fleet.view`/`fleet.manage`, the same permission fleet management
uses, driver management being fleet-adjacent rather than its own
permission), `/admin/contracts/new` and
`/admin/contracts/[id]`, `/admin/payments/batches`,
`/admin/payments/batches/new`, and `/admin/payments/batches/[id]`,
`/admin/payments/reconciliation` (Module 15, gated by
`payments.reconciliation.view`, matching unmatched Paystack transactions
to a vehicle by hand or dismissing them as not belonging to this app;
reachable only from the "Reconciliation" button on
`/admin/payments/batches`, not its own sidebar item, see Known gaps for
why it briefly was one in Module 26), `/admin/transfers` and
`/admin/transfers/[id]`, `/admin/kyc` and
`/admin/kyc/[investorId]`, `/admin/settings/roles`,
`/admin/settings/roles/new`, and `/admin/settings/roles/[id]` (role and
permission management, see below), `/admin/settings/staff`,
`/admin/settings/staff/new`, `/admin/settings/staff/new/success`, and
`/admin/settings/staff/[id]` (Module 27, edit an existing staff or
agent's name/email/phone/job title/region, account type itself isn't
editable; Module 30 added an "Account access" card for resetting their
password)
(create a real staff or agent sign in account, gated by the
`staff.manage` permission, same generated-password pattern as
`/admin/investors/new`), `/admin/settings` (a hub page linking to
whichever settings sections the signed in user has permission for, plus,
since Module 30, a "Security" tile with no permission gate at all, see
below) and
`/admin/settings/contract-terms` (edit each vehicle type's default
contract terms, gated by `settings.manage`, see the SystemSetting entry
above), `/admin/settings/security` (Module 30, two-factor authentication
for the signed-in staff or Admin account's own sign-in, see "Account
security" above), `/admin/wallet` (Module 14, a hub page same pattern as
`/admin/settings`), `/admin/wallet/withdrawals` (the maker-checker
withdrawal review queue, gated by `wallet.view`/`wallet.withdrawal.approve`),
`/admin/wallet/funding` and `/admin/wallet/funding/[investorId]` (every
investor currently holding a wallet balance, and the form to convert one
of theirs into a new contract's principal, gated by
`wallet.funding.manage`), `/admin/reports` (Module 32, gated by
`reports.view`, money in vs. money out across the whole platform for a
chosen date range, defaulting to the last 30 days, with a day-by-day
trace and a per-agent/per-driver/per-investor breakdown, see the Reports
section below), `/admin/reports/portfolio`, `/admin/reports/arrears`,
`/admin/reports/fleet`, and `/admin/reports/kyc` (Module 33, same
`reports.view` gate, contract progress, collections arrears, per-vehicle
profitability, and a KYC status snapshot respectively, see the Reports
section below), `/admin/reports/partner/[kind]/[id]` (Module 33, one
agent/driver/investor's full payment history with CSV and print/PDF
export, `kind` is `agent`, `driver`, or `investor`, reached by clicking
a row on `/admin/reports`'s "By partner" table), `/admin/audit-log`
(Module 17, gated by
`audit.view`, the most recent 100 staff decisions this app records,
filterable by entity type, see the Audit log section below).

**API**: `/api/webhooks/paystack` (Route Handler, verifies and processes
`charge.success`, `transfer.success`, and `transfer.failed` events).
`app/admin/reports/partner/[kind]/[id]/export/route.ts` (Module 33) is
this app's first *authenticated* Route Handler, a GET that streams a
CSV, checking `getCurrentUser()`/`REPORTS_VIEW` itself since Route
Handlers sit outside the normal Server Component `redirect()` gate every
other admin page uses.

## RBAC: roles and permissions

The permission catalog is a fixed list in code
(`lib/rbac/permissions.ts`, the `PERMISSIONS` object), but which roles
hold which permissions is entirely data driven (`Role`, `Permission`,
`RolePermission`, `RoleAssignment` tables), editable from
`/admin/settings/roles` without touching code. `DEFAULT_ROLE_SEED` in the
same file is only used once, by `prisma/seed.ts`, to create the starting
roles (Admin, Company Admin, Finance, Approver, Operations,
ComplianceReviewer, Investor, Agent, Driver); after seeding, the database
rows are what actually govern access, that seed constant is never read at
runtime.
Adding a new permission key to `PERMISSIONS` (Module 14 added three at
once: `wallet.view`, `wallet.withdrawal.approve`, and
`wallet.funding.manage`, Finance gets view, Approver gets all three;
Module 32 added one more, `reports.view`, granted to Finance) needs
a re-run of `npx prisma db seed` before it does anything, since a
`Permission` row for it has to actually exist in the database, and the
seed's upsert loop is what creates that row and grants it to Admin, this
is safe to re-run any time, nothing it does is destructive.

Every sensitive Server Action calls `requirePermission` from
`lib/rbac/check-permission.ts` before doing anything, the UI hiding a
button is a convenience, this server side check is the real gate.
`assertDifferentActor` enforces maker-checker (a different person must
approve a payment batch or an ownership transfer than the one who created
or verified it), used in `lib/actions/payments.ts` and
`lib/actions/transfers.ts`.

The "Admin" role has `isSystem: true`, it is the only role that does. A
system role's permission set can't be edited and it can't be deleted, but
people can still be added to or removed from it, with one guard: the last
remaining member of a system role can't be removed, so there is never a
path to an app with nobody able to grant access. This is enforced in
`lib/actions/rbac.ts`.

**Admin vs. Company Admin (Module 23).** Both exist for a reason, and
they're not meant to do the same job. Admin, the one `isSystem: true`
role, is reserved for platform configuration: creating staff accounts,
managing roles and permissions, and (eventually) system-wide settings,
signed in only through the separate `/admin-sign-in` door (see
"Authentication" below), deliberately rare and deliberately hard to
reach. Company Admin is an ordinary, fully editable role covering
everything else, investors, fleet, contracts, drivers, payments, wallet,
KYC review, the audit log, meant for whoever actually runs the business
day to day, created the normal way at `/admin/settings/staff/new` and
signed in the normal way at `/sign-in`. Concretely, Company Admin's
starting permission set is every key in `PERMISSIONS` except
`staff.manage`, `rbac.manage`, and `settings.manage`, see
`DEFAULT_ROLE_SEED` in `lib/rbac/permissions.ts`. Nothing stops a staff
member from adjusting that set later from `/admin/settings/roles`, unlike
Admin, this role has no special protection.

## Account security (Module 26)

**Forced password change.** `User.mustChangePassword` is true only for an
account someone else created with a generated temporary password
(`createInvestor`, `createDriver`, `createStaffOrAgentAccount`), false for
anyone who chose their own (`signUpInvestor`, `bootstrapFirstAdmin`).
Every portal layout (`app/admin/layout.tsx`, `app/agent/layout.tsx`,
`app/investor/layout.tsx`, `app/driver/layout.tsx`) redirects to
`/change-password` while it's true, before rendering anything else.
`changePassword` in `lib/actions/auth.ts` sets it back to false the
moment they actually change it, nowhere else does.

**`/change-password`**, one shared page for every portal (same reasoning
as `/kyc`, it can't live behind a portal-specific layout that would
redirect the wrong kind of account away first), reached two ways: forced,
as above, or voluntarily, via a "Change password" link in `AppShell`'s
account area, visible in every portal all the time. Always requires the
current password even on a forced first change (verified with
`signInWithPassword` against a throwaway client,
`createSupabaseAnonClient` in `lib/supabase/server.ts`, that never
touches the request's real session cookies), requires a new password at
least 8 characters and different from the current one, then updates the
password through Supabase Auth's admin API
(`supabaseAdmin.auth.admin.updateUserById`) and clears
`mustChangePassword`.

**On the "SQL injection and other attacks" question directly**, asked
outright during Module 26: every database read and write in this codebase
goes through Prisma's typed query builder, confirmed by grep, there is no
`$queryRawUnsafe`, `$executeRawUnsafe`, or raw SQL string concatenation
anywhere in `lib/` or `app/`. Prisma parameterizes every query it builds,
so SQL injection is not a risk this app's code can introduce by mistake,
not something bolted on, it's a property of never writing raw SQL in the
first place. Cross-site scripting is similarly structural: React escapes
everything rendered in JSX by default, and a grep for
`dangerouslySetInnerHTML` across the whole codebase returns nothing.
Cross-site request forgery is handled by Next.js itself, Server Actions
carry a built-in same-origin check on every request. Passwords are never
stored, hashed, or otherwise handled by this app's own database at all,
Supabase Auth owns that entirely, every action that touches a password
(`signUpInvestor`, `bootstrapFirstAdmin`, `changePassword`, the three
temporary-password creation flows) only ever calls Supabase Auth's own
API, `createUser`, `updateUserById`, or `signInWithPassword`. What this
app's own code does not and cannot provide: rate limiting on repeated
sign-in or password-change attempts, that's Supabase Auth's own
responsibility server-side, and a broader bot/abuse layer (a WAF, a
CDN-level rate limiter) sitting in front of the whole deployment, which is
infrastructure to set up at go-live, not application code, see the
"Go-live checklist" the project owner was offered as a candidate next
module.

**Staff-managed password reset (Module 30).** An investor, driver, staff
member, or agent locked out of their account no longer needs a database
edit to get back in: whoever holds the matching manage permission
(`INVESTORS_MANAGE` on `/admin/investors/[id]`, `FLEET_MANAGE` on
`/admin/drivers/[id]`, `STAFF_MANAGE` on `/admin/settings/staff/[id]`) can
generate a new temporary password from an "Account access" card on that
account's edit page, `resetInvestorPassword`/`resetDriverPassword`/
`resetStaffOrAgentPassword` in `lib/actions/investors.ts`/`drivers.ts`/
`staff.ts`. Same shape every time: a random password is set through
Supabase Auth's admin API (`supabaseAdmin.auth.admin.updateUserById`,
never Prisma, passwords still live only in Supabase Auth, see the SQL
injection paragraph above), `User.mustChangePassword` is set so the
account is forced through `/change-password` on next sign-in, the
password is shown once in the shared `PasswordResetPanel` component
(`components/admin/password-reset-panel.tsx`) the same way a freshly
created account's password is, and the action is written to the audit
log (`investor.password_reset`, `driver.password_reset`,
`user.password_reset`). A driver with no `User` account at all (created
before Module 22) has no card to click, there's no Supabase Auth account
to reset a password on, `driver.hasAppAccess` gates whether the card
renders at all. What this does **not** do, disclosed rather than
implied: revoke sessions already signed in on another device, Supabase's
admin API used here has no "sign out everywhere" call, so a stolen
session survives a password reset until it naturally expires, see Known
gaps.

**Two-factor authentication (Module 30).** Every account type, investor,
agent, driver, staff, and Admin alike, can turn on an authenticator-app
based second sign-in step from a new Security page: `/investor/settings`,
`/agent/settings`, `/driver/settings` (the three renamed from
`/investor/security`, `/agent/security`, and `/driver/security` in round
eleven), and `/admin/settings/security` (staff and Admin, reached from
the settings hub, deliberately the one
`/admin/settings` tile with no manage-permission gate, since it's about
the signed-in account's own security, not something administered for
someone else). All four render the same `MfaSettings` Client Component
(`components/account/mfa-settings.tsx`), built entirely on Supabase
Auth's own MFA support (`supabase.auth.mfa.enroll`/`challenge`/`verify`/
`unenroll`/`listFactors`), nothing new in `prisma/schema.prisma`, Supabase
tracks enrolled factors itself. Deliberately optional, not required of
anyone, a direct choice made when this was scoped rather than an
oversight: turning it on is available to everyone, nobody already using
the platform is blocked by it. Once a factor is verified, the two
password sign-in pages, `/sign-in` and `/admin-sign-in`, check
`supabase.auth.mfa.getAuthenticatorAssuranceLevel()` right after the
password succeeds and, if a second factor is required, hold at a new
6-digit code screen before running their existing post-sign-in logic
(`completeSignIn` in each page, the Admin-role check and
`resolvePortalDestination` routing untouched, just moved behind the
code check).

Round twelve rebuilt `MfaSettings` to render as one row (icon, "Two-factor
authentication," a status line, and a `ToggleSwitch`,
`components/ui/toggle-switch.tsx`) instead of a plain "Turn on"
button, sitting inside the "Security" `SettingsGroup` next to a
"Password" row. Turning it off is still a single click, unchanged from
before this round. Turning it on can't honestly be instant, TOTP
enrollment needs a QR code scanned and a 6-digit code verified, so the
toggle reflects on/off only; clicking it while off expands the same
QR-code-and-verify form this component always had, now inline below
the row inside the same card rather than the component's only content.
Matches keke-mobile's identical rebuild of its own MFA row this same
round (`keke-mobile/src/app/(app)/profile.tsx` and
`two-factor-setup.tsx`).

**Self-service phone number update, Module 40, extended round ten.**
`updateOwnPhone` (`lib/actions/auth.ts`) lets any signed-in account
update their own `User.phone`, no service-role client needed, phone
carries no Supabase Auth entanglement the way email does. Portal-agnostic
like the MFA settings above, and, since round ten, wired into all four
portal settings pages' "Phone number" card
(`components/account/phone-settings-form.tsx`): `/investor/settings`
(Module 39), and now `/agent/settings`, `/driver/settings`, and
`/admin/settings/security` too, all four now revalidated on save, see
the round ten entry below for the full write-up and the caching bug that
entry found and fixed along the way. (The three portal paths were named
`/investor/security`, `/agent/security`, and `/driver/security` at the
time, renamed in round eleven, see that entry below.) Round twelve
wrapped the form itself in a new `PhoneNumberRow`
(`components/account/phone-settings-form.tsx`), a plain "Phone number"
row in the "Personal data" `SettingsGroup` that expands
`PhoneSettingsForm` below itself when clicked, rather than the form
always being shown. This is the web
counterpart to `keke-mobile`'s Security screen "Phone number" card and
`POST /api/v1/auth/update-phone`
(both Module 39), mirrored field for field rather than sharing an
implementation, same reasoning as `changePassword` already having both
a Server Action here and a separate API route for the mobile app. Email
has no edit affordance anywhere near this, on purpose, in either app:
it doubles as the sign-in identity and changing it stays an admin-only
capability (`updateInvestor`, `lib/actions/investors.ts`).

**Magic-link gap closed, Module 34.** The one sign-in path the AAL check
above never covered, `/sign-in`'s "send a login link by email" option
(`admin-sign-in` has no magic-link option at all, only the password
path exists there). New `checkMagicLinkBlocked` (`lib/actions/auth.ts`)
resolves the submitted email to this app's own `User.authId`, calls
`supabaseAdmin.auth.admin.getUserById` for that account's MFA factors,
and if a verified one exists, `app/sign-in/page.tsx`'s `handleMagicLink`
shows an error and never calls `supabase.auth.signInWithOtp` at all, no
email goes out and no session gets created. Chosen over the alternative
Module 30 named (an AAL check after the magic link's own redirect)
because this app has never had an `/auth/callback` route for that
redirect to land on, building one is a real new flow; blocking before
the email is even sent needed no new route. An email with no matching
`User` row, or an admin API lookup failure, is deliberately not
blocked, this only ever adds a restriction, never a false one that
would take magic-link sign-in down for every account over an unrelated
Supabase hiccup.

## Payments

**Collections, agent/driver to the business.** Each agent and driver gets
a Paystack Dedicated Virtual Account, actually provisioned since Module
21 by `provisionAgentCollectionAccount()`/`provisionDriverCollectionAccount()`
in `lib/payments/collection-account.ts` (wrapping
`lib/payments/paystack-provider.ts`'s `createCollectionAccount`), called
from agent creation (`lib/actions/staff.ts`) and driver creation
(`lib/actions/drivers.ts`), with a manual "Create" retry button on
`/admin/settings/staff` and `/admin/drivers` for anyone whose
provisioning failed or, for every agent created before Module 21, was
never attempted at all. A transfer into that account fires a
`charge.success` webhook identifying the payer by Paystack customer code,
`lib/payments/webhook-handler.ts` records it, applies it to that
collector's vehicle's earliest unpaid schedule entry as a starting guess
(staff can re-allocate if that's wrong), and SMS's whoever it matched
that a deposit landed, see "Notifications" below.
`findEarliestUnpaidScheduleEntry` (same file) is the one place the
allocation rule lives, exported so the manual reconciliation path below
applies it identically rather than duplicating it.

Since Module 22, every driver created through `/admin/drivers/new` gets a
real Supabase Auth account at creation, the same generated-password
pattern staff and investor accounts already use, an email address is now
required alongside the phone number for exactly that reason. Most
drivers will never actually sign in, the account just sits ready, but it
is real and trackable from day one rather than something decided for
them later. `Driver.userId` stays optional on the schema purely for
backward compatibility, drivers created before Module 22, or created
directly against the database (the seed script), are not guaranteed one.
For that legacy case, Paystack's customer endpoint requires an email
regardless, there is no phone-only path, so a driver with no linked User
still gets a placeholder address derived from their phone,
`driver.<digits>@no-reply.keke-platform.internal`, that satisfies the
field and is never actually mailed to, see the Module 21 README entry
for the full reasoning. A phone number is required to create a driver
for this reason either way.

**Reconciliation, `/admin/payments/reconciliation`** (Module 15). When a
`charge.success` has no Paystack customer code, or one that doesn't match
any `Agent` or `Driver`, `handleChargeSuccess` marks the
`ProviderTransaction` `UNMATCHED` instead of guessing. The money already
moved (it landed in a Paystack Dedicated Virtual Account), what's missing
is which vehicle's contract it should count toward. This screen lists
every `UNMATCHED` row (decoded from the stored raw payload for display,
amount/customer/reference, with the full payload behind a disclosure),
and staff either match it to a vehicle (`matchProviderTransaction` in
`lib/actions/reconciliation.ts`, applies the exact same ledger logic
`handleChargeSuccess` would have) or dismiss it as not belonging to this
app at all (`dismissProviderTransaction`, marks it `PROCESSED` with no
`PaymentTransaction` created). `getUnmatchedCount` backs a small badge
next to a "Reconciliation" link on `/admin/payments/batches`, that button
is the only way in, deliberately not its own sidebar item (Module 26
briefly added one, removed again in Module 27, see Known gaps), and the
admin dashboard's "N unmatched transactions" alert links here too.
**Module 27**: both actions above used to throw on every failure path
(already resolved, no permission, missing amount) while bound directly to
plain form actions, crashing to Next's generic error boundary instead of
showing staff what went wrong, the same shape as the bugs fixed in
Modules 25 and 26. This page had no sidebar link at all until Module 26,
so this was very likely never actually exercised before it was reported
broken. Both now return `{error?}`, the page's two forms are Client
Components.

**Real bug, caught by a real `next build` in Module 31, same shape as the
Module 29 KYC crash**: the "Recently processed" list on this page
(`getRecentlyProcessedTransactions`, `lib/data/reconciliation.ts`) tried
to `include: { agent: {...}, driver: {...} }` on a fetched
`paymentTransaction`, treating `PaymentTransaction.agentId`/`.driverId`
as real Prisma relations. They never were, both are plain `String?`
columns on that model, unlike `providerTransaction`, `batchItem`, and
`allocations`, which are real relations. Never actually hit until a real
build's type check caught it, this list only renders once a `PROCESSED`
`charge.success` row with a linked `PaymentTransaction` exists, an easy
path to never exercise by hand. Fixed the same way Module 29's KYC crash
was: two follow-up lookup queries (`prisma.agent.findMany`,
`prisma.driver.findMany`) build `id -> name` maps instead of an invalid
`include`, no schema change or migration needed.

A transfer event (`transfer.success`/`failed`/`reversed`) can also end up
`UNMATCHED`, if its `reference` doesn't resolve to a `PaymentBatchItem` or
a `WalletWithdrawal`. Building this reconciliation screen is what
surfaced a real bug from Module 14: `handleTransferUpdate` only ever
checked `PaymentBatchItem`, so a wallet withdrawal's transfer
confirmation webhook would have landed here as unmatched every time
instead of updating the withdrawal. Fixed by adding
`applyWalletWithdrawalTransferOutcome` (`lib/payments/batch-processor.ts`,
idempotent the same way `applyTransferOutcome` is, and deliberately does
not touch the wallet ledger again, `approveWalletWithdrawal` already
debited it synchronously at approval time) and checking both tables
before giving up.

**Payouts, business to investors.** `PaymentBatch` groups a week's
payouts. Creating a batch and approving one are different permissions
held by different people (`payments.batch.create` /
`payments.batch.approve`), enforced server side. Approving creates a
Paystack transfer recipient for anyone who needs one (using
`resolveBankAccount`/`createTransferRecipient` against whatever bank
details the investor has on file, see `/investor/payout-details` above)
then calls Paystack's transfer API per item. `applyTransferOutcome` in
`lib/payments/batch-processor.ts` is the single function both the
synchronous approve-time result and the later `transfer.success`/
`transfer.failed` webhook call, so a transfer that resolves immediately
and one confirmed later by webhook can never double process the same
payment. The moment a contract's total paid to the investor reaches its
`targetPayoutAmount`, this same function flips the contract to
`TARGET_ACHIEVED` and creates the `OwnershipTransfer` row, inside the same
database transaction as the ledger update, so the two can never disagree.
Both the investor (bundled into their "you've been paid" notification)
and, **since Module 27**, every staff member holding `transfer.verify`
(`notifyStaffOfTargetAchieved`, same file, emailed, never throws) are
told the moment this happens, previously only the investor was.

**Investor bank details are typed in, never generated (Module 30
clarification).** Worth being explicit about, since it comes up: an
investor is not an agent or a driver, and their bank details work
opposite to how a collection account does. An agent or driver gets a
real Paystack Dedicated Virtual Account provisioned automatically, since
money flows **into** the platform from them, see "Account model" above.
An investor is paid **out of** the platform instead, weekly or on
whatever schedule was agreed, and Paystack has no equivalent
"auto-generate a payout destination" product, someone has to say which
real-world bank account that money actually goes to. That's a deliberate
manual step: an admin or assigned staff member (`INVESTORS_MANAGE`) types
it in, on `/admin/investors/new` at the point of onboarding them (Module
30 addition, optional, see below) or afterward on
`/admin/investors/[id]`'s "Bank account" card, or the investor types it
in themselves on `/investor/payout-details`, choosing a bank from a
dropdown (`provider.listBanks()`) and entering the 10-digit account
number. Paystack's role here is verification only, `resolveBankAccount`
confirms the account is real and returns the account holder's name
before any of the three pages will save it, `InvestorProfile.bankCode` /
`bankAccountNumber` / `bankAccountName` are the three fields that come
out of that call, never invented or auto-filled from anywhere else.

**Exactly what that Paystack check does and doesn't confirm (Module 30
clarification, a fair follow-up question worth being precise about)**:
`resolveBankAccount` calls Paystack's `GET /bank/resolve`, which takes
only an account number and a bank code, nothing else, no name to compare
against, since this app never sends it one, an investor's own name is
never part of that request. What it checks is that the account is real,
open, and currently active at that bank, then hands back whichever name
the bank has on file for it, that returned name is what gets saved as
`bankAccountName`, unedited. It does **not** check that name against
`InvestorProfile.user.fullName` or anything else, there is nothing built
today that would catch a resolved account belonging to someone other
than the investor it's attached to (their spouse's account, say, used on
purpose or by mistake), that would need an explicit name-match comparison
and a decision about what to do with a mismatch (block outright, or warn
and let staff decide), neither exists, noted here rather than implied to
exist.

**Decided, not just left open**: raised and settled directly, a
name-match check is deliberately not being added. A company account is
the concrete case that rules it out, an investor investing through a
registered business would have a bank account in the company's name, not
their own, a mismatch there is entirely legitimate, not a red flag, so a
check that blocked or even warned on it would be wrong more often than
right. Staff reviewing the resolved account name against the investor's
own name, case by case, using their own judgment about what's a
reasonable account for that investor, stays the intended safeguard,
exactly the same judgment the "Bank account" card already puts in front
of them (the resolved name is shown right next to the investor's own),
nothing further planned here.

**Bug fixed in Module 30**: all three pages above displayed the saved
account as `{accountNumber} · {bankCode}`, the raw Paystack code
(`"058"`, `"044"`) sitting where a reader would expect the bank's actual
name, indistinguishable from a second account number, exactly what
prompted the question that found this. Neither page stored a separate
bank-name column, only the code Paystack's own API uses, so the two
display pages now resolve `bankCode` back to a name by looking it up in
the same `banks` list already being fetched for the "Select a bank"
dropdown, falling back to the raw code only if that list itself couldn't
load (`PAYSTACK_SECRET_KEY` unset). The admin edit page previously only
fetched that list for staff holding `INVESTORS_MANAGE`; it now also
fetches it for `INVESTORS_VIEW`-only staff, since they need the name
resolved too even though they can't edit it.

**Bank entry was missing from onboarding itself, fixed in Module 30**:
worth being direct that this was a real gap, not a misunderstanding,
bank account entry existed since Module 28 but only on the edit page,
reached after the investor's account already existed, `/admin/investors/new`
(`createInvestor` in `lib/actions/investors.ts`) never collected it at
all. Fixed by adding the same bank dropdown and account-number field,
optional, directly to that creation form: when filled in, it's resolved
against Paystack before the Supabase Auth account is even created (a bad
account number is now caught before anything is created, rather than
leaving a real sign-in account behind with a bank problem to fix
afterward, `bankCode` and `accountNumber` must both be present or both be
absent, one without the other is rejected); left blank, investor creation
works exactly as it always has, bank details can still be added
afterward from the edit page, for whenever staff doesn't have them yet
at signup or `PAYSTACK_SECRET_KEY` isn't configured on this machine at
all.

**Confirmed, Module 33: "no way to enter it" traced to exactly that last
sentence.** Reported as the bank entry form being entirely missing on
one machine, even though the code above is unconditional. The actual
cause: `provider.listBanks()` failing (no working `PAYSTACK_SECRET_KEY`
in that machine's own `.env`/`.env.local`) doesn't degrade the form,
it replaces it outright with the error banner (`app/admin/investors/
new/page.tsx` and `app/admin/investors/[id]/page.tsx` both do this on
purpose, a bank code has to resolve against Paystack before it can be
saved, so a form that can't verify anything has nothing useful to show).
That reads, correctly, as "there's nowhere to type it," when the actual
fix is a working key in `.env`/`.env.local`, not a code change,
`.env.example` already lists `PAYSTACK_SECRET_KEY` as the variable to
set.

**Confirmed working, and one real bug found, Module 33 addendum.** The
project owner set a real `PAYSTACK_SECRET_KEY` and `updateInvestorBankDetails`
completed with a 200 in their own dev log, the config issue above is
resolved on their machine. That same log showed a React duplicate-key
warning on five numeric values. Root cause: `PaystackProvider.listBanks()`
(`lib/payments/paystack-provider.ts`) returned Paystack's `/bank` list
as-is, and Paystack's real API is known to repeat the same `code` across
more than one entry (different channels or products under one bank
sharing an NIP/CBN code). All three callers (`app/admin/investors/[id]/
investor-bank-form.tsx`, `app/admin/investors/new/page.tsx`,
`app/investor/payout-details/page.tsx`) render this list into a
`<select>` keyed on `code`, so a duplicate code meant a real duplicate,
indistinguishable `<option>` in the dropdown, not only console noise.
Fixed once at the source: `listBanks()` now dedupes by `code` before
returning (keeps the first entry seen for a given code), so every
caller gets a clean list automatically.

**Module 27 payout safety net**: `getDueScheduleEntriesForBatch`
(`lib/data/payments.ts`) had no `contract.status` filter at all before
this, so a schedule entry belonging to a contract that had already hit
`TARGET_ACHIEVED` early, but whose own due date simply hadn't arrived yet,
could still surface on "New payment batch" and get paid into, a genuine
overpayment past the target, since `recordPayout` increments
`totalPaidToInvestor` unconditionally for whatever amount a
`PaymentBatchItem` carries and never re-checks contract status itself.
Fixed with `contract: { status: "ACTIVE" }` in that query (a contract
leaving `ACTIVE` removes every one of its remaining entries from
consideration permanently, regardless of their individual status), plus a
second, redundant check inside `createPaymentBatch`
(`lib/actions/payments.ts`) that silently drops any submitted entry whose
contract isn't `ACTIVE` anymore, guarding against a "New batch" tab left
open across a target being hit mid-session. The schedule entries
themselves for the remainder of a contract's original term are not
relabeled once this happens, they simply become permanently unreachable
for batching, see Known gaps for that cosmetic-only gap.

**Ownership transfer**, `/admin/transfers`. Same maker-checker shape:
`transfer.verify` confirms the numbers (`TARGET_ACHIEVED` to `VERIFIED`),
a different person with `transfer.approve` completes it (`VERIFIED` to
`COMPLETED`, which is what "the vehicle has changed hands" means in this
system). Either stage can be rejected with a note, which sends it back to
`TARGET_ACHIEVED` rather than deleting anything, the underlying trigger
(the numbers crossing the target) doesn't un-happen just because a
mistake was caught.

**Wallet (Module 14).** A payout can land in an investor's wallet instead
of their bank account. Through Module 25 this was staff picking it per
row on `/admin/payments/batches/new`, never defaulting to wallet on its
own. **Module 26 changed the source of truth**: it's now the investor's
own standing preference (`InvestorProfile.defaultPayoutDestination`, set
at onboarding, editable anytime after on `/investor/payout-details`),
copied onto each `PaymentBatchItem` automatically the moment a batch is
created. Staff still see where each payout is headed on the New batch
screen, they just can't change it there anymore, see the Known gaps entry
below for why. `lib/payments/batch-processor.ts` splits the part of "this investor was
just paid" every payout shares (recording the `PaymentTransaction`,
allocating it, advancing the contract's running total, detecting
target-achieved) into a shared `recordPayout` helper, so
`applyTransferOutcome` (bank, via a real Paystack transfer) and
`applyWalletHold` (wallet, no Paystack call, just a `WalletTransaction`
credit) can never disagree about what a contract has been paid. From
there a wallet balance can go one of two places, and both are always a
staff decision, never something the system proposes or triggers on a
threshold: **withdrawal**, an investor requests one from
`/investor/wallet`, then a staff member with `wallet.withdrawal.approve`
reviews it at `/admin/wallet/withdrawals`, approving debits the ledger
immediately and attempts a real Paystack transfer the same way a batch
item does (a "Mark as paid" fallback exists for confirming one that
didn't settle automatically, since that is exactly as manual as a batch
item transfer already was); **vehicle funding**, a staff member with
`wallet.funding.manage` picks an investor off `/admin/wallet/funding` and
converts some or all of their balance into a brand new contract's
principal on a specific vehicle at `/admin/wallet/funding/[investorId]`,
reusing `generateScheduleDates` (now exported from
`lib/actions/contracts.ts`) so a wallet-funded contract is laid out
identically to a normally-funded one.

## KYC

An investor enters BVN/NIN (`app/kyc/actions.ts`) and uploads a
government ID and proof of address (`lib/actions/kyc.ts`,
`uploadKycDocument`) to a private Supabase Storage bucket named
`kyc-documents` (must be created once, by hand, in the Supabase
dashboard, no migration can create a Storage bucket). Staff review
everything at `/admin/kyc`: each document individually
(`reviewKycDocument`) and the investor as a whole (`reviewInvestorKyc`,
the decision that actually unlocks being added to a contract), staff view
a document through a 10 minute signed URL, the bucket itself is never
public. `KycDocument.reviewedById` (`prisma/schema.prisma`) is a plain
`String?` column, not a real Prisma relation, unlike the identical
reviewer pattern on `WalletWithdrawal`/`OwnershipTransfer`, which do have
one; `getInvestorKycDetail` (`lib/data/kyc.ts`) looks reviewer names up
with a second `staffProfile.findMany` query rather than a Prisma
`include`, see the Module 29 bug fix in Known gaps for why.

## Documents

Staff attach general files, signed contracts, maintenance receipts, asset
photos, anything else worth keeping, to a contract and/or a vehicle from
`/admin/contracts/[id]` or `/admin/fleet/[id]` (`uploadDocument` in
`lib/actions/documents.ts`), to a private Supabase Storage bucket named
`documents` (separate from `kyc-documents`, must also be created once by
hand in the Supabase dashboard). Each upload is gated by whichever
permission the target belongs to, `contracts.manage` for a contract
document, `fleet.manage` for a vehicle-only one, no dedicated document
permission exists. Every upload chooses a visibility, `STAFF_ONLY`
(default) or `PRIVATE_OWNER`; a contract document can be either, a
vehicle-only document has no investor to ever show it to so its upload
form skips the choice entirely and stays `STAFF_ONLY`. `PRIVATE_OWNER`
documents on a contract also show up on that investor's own
`/investor/documents`, view-only, no upload or delete there, same
short-lived signed URL pattern as KYC.

## Audit log

`writeAuditLog()` in `lib/audit.ts` is called from every Server Action
that was already gated behind a `requirePermission` check for something
approval-shaped, destructive, or access-changing: payment batch
approve/reject, ownership transfer verify/approve/reject, wallet
withdrawal approve/reject/mark-paid, wallet vehicle funding, KYC document
and investor review, role create/delete/permission-toggle/assignment,
reconciliation match/dismiss, document delete, system setting update, and
staff/agent account creation. It records `actorUserId` (the `User` row,
not the staff profile, so the same helper works for any signed in user),
a dot-separated `action` string (`entity.verb`, e.g.
`payment_batch.approve`), `entityType`/`entityId`, and a
`beforeState`/`afterState` JSON snapshot wherever there was a meaningful
before to capture. Like `sendNotification`, this never throws, an audit
write failing must never make an otherwise successful staff decision look
like it failed. Where the underlying change already runs inside a
`$transaction`, the audit write goes into that same transaction rather
than firing separately afterward.

Staff view this at `/admin/audit-log`, gated by `AUDIT_LOG_VIEW`
(`audit.view`, existed in the permission catalog and Admin's default
grant since Module 1 with nothing reading or writing it, the same state
`RECONCILIATION_VIEW` was in before Module 15). Shows the most recent 100
entries, newest first, filterable by entity type, each with a `<details>`
disclosure for the before/after JSON. No permission change, migration, or

## Reports (Module 32)

`lib/data/reports.ts`'s `getReportsData({ from, to })` is the one place
every money-flow number in the app is computed: total inflow, total
outflow, net, a day-by-day breakdown (every day in the range zero-filled
before summing rows into it, same discipline as `buildWeeklyTrend`), and
a per-partner breakdown (one row per agent, driver, or investor that had
at least one transaction in range, sorted by total activity). Backed by
one query against `PaymentTransaction` for the date range, excluding
`REVERSED` (defined on `PaymentTransactionStatus` but not currently set
by any code path, excluded defensively anyway), everything else is
derived from that result set in JS rather than separate aggregate
queries, so the summary total and the daily trace can never add up to
different numbers. `agentId`/`driverId`/`investorId` on
`PaymentTransaction` are plain `String?` columns, not relations (see the
Module 29/31 bug fixes above), so partner names are resolved with the
same established pattern, collect distinct ids present, run one
follow-up `findMany` per partner type, build `id -> name` maps.

`/admin/reports`, gated by `REPORTS_VIEW` (`reports.view`, granted to
Finance and to Admin/Company Admin by default), is a `from`/`to`
GET-navigation filter (defaulting to the last 30 days) over that data:
four summary cards, two `AreaTrendChart` instances (inflow, outflow),
a full daily trace table, and a by-partner breakdown table. `/admin/
dashboard` also calls into the same module (`getMonthToDateFlowSummary`,
the current calendar month so far) for two new stat cards, inflow and
outflow this month, added beneath the existing four fleet cards, so the
dashboard's headline numbers and the Reports tab's numbers for the same
period are structurally guaranteed to match.

No permission change, migration, or
reseed was needed, `AUDIT_LOG_VIEW` was already granted to Admin and
`audit_logs` has existed in the database since the first migration.

**Module 33 additions.** Four more reports live in the same file, each
its own query (the underlying tables, `InvestmentContract`,
`PaymentScheduleEntry`, `Vehicle`, `MaintenanceRecord`,
`InvestorProfile`, are different enough from `PaymentTransaction` that
folding them into `getReportsData` would hurt readability, not help
it), all gated by the same `REPORTS_VIEW` permission, no new key:
`getPortfolioProgressReport()` (`/admin/reports/portfolio`, every open
contract's percent toward target payout and its overdue schedule entry
count, ACTIVE/TARGET_ACHIEVED/TRANSFER_IN_PROGRESS contracts only, a
completed or cancelled contract has nothing left to track);
`getArrearsReport()` (`/admin/reports/arrears`, every schedule entry
currently DUE/PARTIALLY_PAID/DEFERRED with a due date strictly before
today, attributed to the vehicle's current agent, "Unassigned" when it
has none, plus a by-agent summary keyed on agent id, not display name,
two agents sharing a name must not collapse into one row);
`getFleetProfitabilityReport()` (`/admin/reports/fleet`, per vehicle:
collections in, summed straight off `PaymentScheduleEntry.amountPaid`
rather than re-derived from `PaymentTransaction`; investor payouts out,
summed off `PaymentBatchItem.amount` where `transferStatus: "SUCCESS"`;
maintenance cost out, `MaintenanceRecord.cost`, optional, treated as 0
when never logged; net margin is what the vehicle earned the business,
not the investor's own return); `getKycSnapshotReport()`
(`/admin/reports/kyc`, investor counts by `kycStatus` platform-wide plus
a worklist of everyone still `NOT_STARTED`/`PENDING_REVIEW`, oldest
first, a reporting rollup distinct from `/admin/kyc`'s actual review
queue). `components/admin/reports-tabs.tsx` is the tab strip shared by
all five Reports pages (plain links, not client tab state).

Both `getPortfolioProgressReport` and `getArrearsReport` originally
compared `dueDate` against `new Date()`, the current instant, rather
than the start of today, a self-caught bug (found re-reading the logic
against `getInvestorsDueToday`'s own boundary before shipping, not by a
test): a schedule entry due at today's own midnight would have counted
as overdue the instant the clock passed 00:00, disagreeing with the
dashboard's "due today" window. Fixed by using `startOfDay()` for both,
same helper Module 32 added to `lib/utils.ts`.

`getPartnerStatement({ kind, id, range })` is one agent, driver, or
investor's full payment history, all time by default, an optional range
narrows it. Every row on `/admin/reports`'s "By partner" table links to
`/admin/reports/partner/[kind]/[id]`, the statement page built on top of
it (`kind` is `"agent" | "driver" | "investor"`, `PartnerBreakdownRow`
carries `id`/`kindPath` for the link). Two export paths, deliberately
not one new PDF library: `app/admin/reports/partner/[kind]/[id]/export/
route.ts`, an authenticated Route Handler (checks `getCurrentUser()` and
`REPORTS_VIEW` itself, this app's first Route Handler that isn't the
Paystack webhook) returning the same statement as UTF-8 CSV with a
leading byte-order mark, opens directly in Excel; and
`components/admin/print-button.tsx`, a client component wrapping
`window.print()`, since every major browser's print dialog already
offers "Save as PDF." `print:hidden` was added to the sidebar
(`components/layout/app-shell.tsx`) and to `ReportsTabs`/the filter
form, so printing (or saving as PDF) shows just the statement, not the
app chrome around it.

## Error tracking

`@sentry/nextjs`, wired up in Module 18. `instrumentation.ts` calls
`Sentry.init` once per server process and exports `onRequestError`;
`instrumentation-client.ts` does the same for the browser and exports
`onRouterTransitionStart`, both required by the current SDK. `next.config.ts`
wraps the config in `withSentryConfig`, which uploads source maps at build
time when `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are set so a
captured error points at real source instead of minified code. Every one
of these, including the DSN itself (`NEXT_PUBLIC_SENTRY_DSN`), is
optional: leave it all unset and Sentry stays fully off,
`enabled: Boolean(NEXT_PUBLIC_SENTRY_DSN)` is explicit about that.

Most errors reach Sentry automatically, the SDK wraps Server Actions,
Route Handlers, and Server Components on its own. Manual
`Sentry.captureException`/`captureMessage` calls exist only where an
error is deliberately swallowed by design and nothing else would ever see
it: the Paystack webhook handler's catch in
`app/api/webhooks/paystack/route.ts` (a failed interpretation still
returns 200 to Paystack on purpose), `sendNotification` in
`lib/notifications/send-notification.ts` (a FAILED `Notification` row has
no UI anywhere surfacing it), `writeAuditLog`'s own catch in
`lib/audit.ts`, and the compensating rollback in `signUpInvestor`
(`lib/actions/auth.ts`) when the Postgres half of account creation fails
after the Supabase Auth half already succeeded. Routine, already
UI-visible business failures (a payment batch item or wallet withdrawal
transfer failing because an investor has no bank details on file, for
example) are deliberately not sent to Sentry, that would just be noise on
top of a `failureReason` staff can already see.

`app/error.tsx` and `app/global-error.tsx` are this app's first error
boundaries. `error.tsx` catches anything thrown below the root layout
(nearly everything), reports it in a `useEffect`, and shows a branded
"Try again" screen. `global-error.tsx` catches the rarer case of the root
layout itself throwing; Next.js requires it to render its own
`<html>/<body>` since the root layout is gone by then, so it is
deliberately plain inline styles rather than depending on `globals.css`,
which never loads in that scenario.

## Testing

Vitest, wired up in Module 19 (`vitest.config.mts`, `npm test` /
`npm run test:watch`). 80 tests across 6 files, all colocated as
`*.test.ts` next to the code they cover rather than in a separate
directory. No database connection or environment variables are needed to
run it.

Two kinds of coverage, deliberately scoped to what this sandbox can
actually verify (see "Prisma CLI" in Known gaps: no working query engine
here means no real integration testing against a live Postgres database
is possible in this environment regardless of Postgres itself being
installed):

- **Pure functions, tested directly, no mocking:** `lib/utils.test.ts`,
  `lib/schedule.test.ts` (including regression tests for the month-end
  clamping fix from Module 18, pinning it against ever silently
  regressing), `lib/payments/paystack-client.test.ts`,
  `lib/notifications/termii-provider.test.ts`.
- **Prisma-coupled business logic, tested against a deep mock:**
  `lib/payments/batch-processor.test.ts` and
  `lib/payments/webhook-handler.test.ts`, using `vitest-mock-extended`'s
  `mockDeep<PrismaClient>()`. `$transaction` is configured to invoke its
  callback with the same mock object as `tx`, so assertions set up on the
  outer mock also catch calls made inside a transaction. `Decimal` fields
  are stood in with plain numbers, a documented simplification, not a
  claim it matches Prisma's `Decimal` behavior exactly.

A bug was found while reasoning through what test cases
`verifyPaystackSignature` needed, before any test ran: it called
`crypto.timingSafeEqual` without checking buffer lengths first, which
throws a `RangeError` on a length mismatch instead of returning `false`.
A malformed or wrong-length `x-paystack-signature` header would have
crashed the webhook route with a 500 instead of a clean 401. Fixed in
`lib/payments/paystack-client.ts` with an explicit length check, and
pinned with a regression test asserting the function does not throw.

## Notifications

Investors get an email and/or SMS at three points: a payout landing in
their account (`lib/payments/batch-processor.ts`), an ownership transfer
completing (`lib/actions/transfers.ts`), and their KYC status changing
(`lib/actions/kyc.ts`). Agents and drivers get an SMS at a fourth point,
since Module 21: a remittance landing in their Paystack collection
account (`handleChargeSuccess` in `lib/payments/webhook-handler.ts`).
All four call `sendNotification()` in
`lib/notifications/send-notification.ts`, which records a `Notification`
row (`PENDING` then `SENT` or `FAILED`) for every attempt and never
throws, a notification failing to send must never make an otherwise
successful business action look like it failed.

A driver with no linked User account is the one recipient in this app
`sendNotification` cannot record a message for, `Notification.recipientUserId`
is a required foreign key, there is no User to attach one to. For that
case, `sendUntrackedSms()` (same file) sends the SMS directly with no
`Notification` row behind it, a deliberate, disclosed gap: that message
will never appear in any notification history the way every other one in
this app does. A send failure there is only visible in Sentry. Since
Module 22 every driver created through the app gets a real User account,
so in practice this path now only fires for a driver created before
Module 22, or created directly against the database, who was never given
one; see "Payments" above.

**Audited, Module 34: nine distinct `sendNotification` types exist
today**, the paragraph above (three, then a fourth) predates several of
them and is left as historical color rather than rewritten wholesale.
The full current list: `kyc_status_changed`, `payment_received` (both
the bank-payout and wallet-credit forms), `contract_target_achieved`
(staff-facing, EMAIL only, deliberately, an internal ops notice rather
than a user-facing alert), `remittance_received`,
`wallet_withdrawal_approved`, `wallet_withdrawal_rejected`,
`wallet_vehicle_funded`, `ownership_transfer_completed`,
`password_changed` (`changePassword`, `lib/actions/auth.ts`, sent the
moment a password update succeeds, so the account holder finds out
even if they weren't the one who changed it), and new in Module 35,
`account_created`. Every one of these was checked and is genuinely
wired up and triggered, nothing stubbed. Separately noted, not yet
fixed: `rejectOwnershipTransfer` (`lib/actions/transfers.ts`) has no
`sendNotification` call at all, an investor is emailed when a transfer
completes but not when it's sent back for correction, likely an
oversight rather than a decision, worth a look next time that file is
touched. Confirmed, still true: an account *confirmation* email and a
re-verification-on-email-change email do not exist anywhere, by
design, every account this app creates is created with
`email_confirm: true` already set, pre-confirmed by whoever created
it, so there is nothing to confirm by email in the first place.
Password reset (`/forgot-password`) and the magic-link sign-in email
are sent by Supabase's own outgoing-email system directly, not through
this Resend funnel at all.

**`account_created`, Module 35**: a plain welcome message, not a
confirmation link, sent from all four account-creation paths the
moment the account exists: `signUpInvestor` (self-serve,
`lib/actions/auth.ts`), `createInvestor`, `createDriver`, and
`createStaffOrAgentAccount` (all staff-created). Self-serve investors
get "welcome, your account is ready", they picked their own password
and are signed straight in by the sign up page itself. Staff-created
accounts get "an account has been created for you, whoever set this
up will share your sign-in details with you shortly", deliberately
without the generated temporary password itself in the message, that
password stays exactly where it already was, shown once on the
creation success screen (`/admin/investors/new/success` and its two
siblings) for staff to relay by hand, see `generateTemporaryPassword`
in each of the three `lib/actions/*.ts` files. An email or text
carrying a plaintext temporary password would be a real regression
from that.

**SMS parity, Module 35**: `password_changed` went out EMAIL-only when
it was first added in Module 34, now EMAIL + SMS, matching every other
account-security notification in this app (`kyc_status_changed`,
`wallet_withdrawal_approved`/`_rejected`), and arguably the single
alert most worth landing on a phone fast. `contract_target_achieved`
was checked and deliberately left EMAIL-only, that one is an internal
staff ops notice fanned out to everyone holding `TRANSFER_VERIFY`, not
a user-facing security alert, the two are not the same kind of
message and don't need the same channel treatment.

Email goes through Resend (`lib/notifications/resend-provider.ts`),
needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. SMS goes through Termii
(`lib/notifications/termii-provider.ts`, `termii-client.ts`), needs
`TERMII_API_KEY` and `TERMII_SENDER_ID` (the sender ID must already be
registered and approved in the Termii dashboard, an unapproved one makes
every send fail even with a valid key). SMS is silently skipped, not
attempted and marked failed, for anyone with no phone number on file,
since phone is optional throughout this app. Both providers are behind
interfaces (`EmailProvider`/`SmsProvider` in
`lib/notifications/provider.ts`), mirroring how `PaymentProvider`
abstracts Paystack, so a second email or SMS vendor could be added later
without touching any of the three call sites above.

## Mobile / external API (Module 35)

The start of a real API surface for something outside this Next.js app,
first and foremost the mobile app, to call. Nothing before this could be
called from outside this app's own browser session: a Server Component
reads the signed-in user from cookies (`getCurrentUser`,
`lib/auth/current-user.ts`), and a Server Action is only reachable from a
form or a client call already running on one of this app's own pages,
neither exists for a React Native app on someone's phone.

**Auth.** The mobile app authenticates directly against the same
Supabase project this web app already uses, same
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, exposed
to Expo as `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`,
using Supabase's own client SDK the same way `/sign-in` does, which
gets it a Supabase access token. Every request to an `/api/v1` route
then sends that token as `Authorization: Bearer <token>`.
`authenticateApiRequest` (`lib/api/auth.ts`) is what every route calls
first: it validates that specific token against Supabase
(`supabase.auth.getUser(token)` on the anon-key client, never the
service-role one, the same trust level as a browser holding a session
cookie), resolves it to this app's own `User` row plus whichever
profile (investor/staff/agent/driver) and permission `Set` belong to
it, the exact same shape `getCurrentUser()` already returns for the
cookie-based web session. Deliberately its own function rather than a
second mode bolted onto `getCurrentUser` itself: that one is wrapped in
React's `cache()` and reads `next/headers` cookies, neither fits a
bearer token read from a plain `Request`.

Because `authenticateApiRequest` returns the identical `CurrentUser`
shape, a route handler can call the exact same `lib/data`/`lib/rbac`
functions every existing page already calls, permission checks
included, none of the business logic needs to be rewritten or
duplicated for mobile, only a thin route per screen that authenticates,
checks the right permission, and calls the same function a web page
would.

**`proxy.ts` (this app's middleware) exempts all of `/api/` from its own
cookie-based auth check**, Module 37 bug fix. It used to only skip a
fixed list of public page paths, gate everything else on a Supabase
*cookie* session (the same check a page navigation needs), and redirect
to `/sign-in` otherwise, which silently caught every `/api/v1` request
too: the mobile app never sends cookies, only the bearer token
`authenticateApiRequest` above already checks, so every mobile API call
was getting redirected to the sign-in page's HTML before it ever reached
its route. That redirect still resolved with an HTTP 200, so it wasn't
even an obvious failure on the client, `apiFetch`
(`keke-mobile/src/lib/api.ts`) never threw, it just silently returned
nothing useful, and the investor dashboard looked empty rather than
erroring. Found only by testing sign-in on a real phone and reading the
dev server's own request log, nothing in this repo's checks (ESLint,
`tsc`, vitest) exercises `proxy.ts` against a real bearer-token request
the way the phone does.

**Versioned from the start**: every route lives under `app/api/v1/`,
not bare `app/api/`, a mobile app installed on someone's phone cannot
be forced to update the moment a response shape changes the way a web
page's next deploy instantly is, a `v2` can exist alongside `v1` for as
long as an old app build is still in use.

**Built so far**: `GET /api/v1/me` (`app/api/v1/me/route.ts`), a
mobile client's very first call, "is this token still valid, which
portal does this account belong to." Returns `id`, `fullName`, `email`,
`phone`, `portal` (`"staff" | "agent" | "driver" | "investor"`, same
staff-then-agent-then-driver-then-investor priority order
`resolvePortalDestination` in `lib/actions/auth.ts` already uses
for the web sign-in page, in case a `User` row ever has more than one
profile), `mustChangePassword`, and the flat permission list. 401 if
the token doesn't resolve to a signed-in user, 403 if it resolves to a
`User` with none of the four profiles at all.

**Also built, Module 37**: `GET /api/v1/investor/summary`
(`app/api/v1/investor/summary/route.ts`), the first route beyond "who
is this" to return real business data. 401 if not signed in, 403 if
the account has no investor profile, otherwise the exact JSON shape
`getInvestorDashboardData` (`lib/data/investor.ts`) already produces
for `app/investor/dashboard/page.tsx`: `stats` (totalInvested,
totalRealized, outstanding, activeInvestments, totalInvestments,
walletBalance), `vehicles[]` (assetTag, type, agentName, location,
status, progressPercent, realized, target, weekly, plus
`plateNumber`/`frameNumber`/`startDate`/`driverName`/`driverAssignedSince`,
added to that function's vehicle query specifically for the mobile
Fleet screen below, the web dashboard card doesn't render them),
`recentPayments[]` and `upcomingPayments[]` (vehicle, week, amount,
date, status each, split as of Module 38, see below), and
`payoutTrend` (weeks, amounts, latestLabel, latestAmount). No
permission check beyond "does this account have an investor profile":
the web dashboard page itself doesn't call `hasPermission` either, an
investor only ever sees their own data.

**Also built, Module 38**: `POST /api/v1/auth/change-password`
(`app/api/v1/auth/change-password/route.ts`), mirroring the web app's
`changePassword` Server Action (`lib/actions/auth.ts`) exactly:
verifies the current password via `signInWithPassword`, rejects a new
password under 8 characters or identical to the current one, updates
it with the service-role client (needs `auth.admin.updateUserById`,
the reason this can't be a client-side Supabase call from the mobile
app the way MFA is, see the Module 38 mobile section below), clears
`mustChangePassword`, and sends the same change-notification email/SMS
the web action sends. Two-factor authentication needed no equivalent
mutation route, `supabase.auth.mfa.*` runs entirely client-side against
the signed-in session with the anon key already on the device.

**`getInvestorDashboardData`'s `recentPayments`/`upcomingPayments`
split, Module 38**: previously one flat `recentPayments[]`, sorted by
date, that could and did contain not-yet-due entries (a schedule entry
with a future due date sorts wherever its date lands, not necessarily
last). Now computed from a shared `allEntries` flat map: `recentPayments`
keeps only `PAID`/`DEFERRED` entries (already happened), most recent
first; `upcomingPayments` keeps only `UPCOMING` entries (which itself
collapses the schedule's `UPCOMING`/`DUE`/`PARTIALLY_PAID` states via
`mapScheduleStatus`), soonest due first. Both cap at 6.

**Also built, Module 39**: `GET /api/v1/investor/payments`
(`app/api/v1/investor/payments/route.ts`), the mobile Payment History
screen's data source, wrapping `getInvestorPaymentHistory`
(`lib/data/investor.ts`, unchanged consumer: `/investor/payments` on
the web still calls it with no arguments and gets everything, same as
before). Takes optional `from`/`to` query params (`YYYY-MM-DD` or
anything `Date` can parse) to narrow the result to a date range, for
"track their payments beyond what fits on the screen," a request made
after the Home/Wallet payment sections turned out to still be capped
previews. `getInvestorPaymentHistory` itself now takes an optional
`filters: { from?: Date; to?: Date }` second argument, applied AFTER
computing the full per-contract `week` numbering, not as a Prisma
`where` on `scheduleEntries`, see that function's own comment: querying
a narrowed set of schedule entries directly would have silently
renumbered every week relative to the narrowed set instead of the
contract's real, full schedule.

**Also built, Module 39**: `POST /api/v1/auth/update-phone`
(`app/api/v1/auth/update-phone/route.ts`), lets a signed-in user update
their own phone number, portal-agnostic like change-password (any
signed-in user, not just investors). A plain `prisma.user.update`, no
service-role client needed, phone is just a `User` column with no
Supabase Auth entanglement the way email has. Validates digit count
(10-15), sends an EMAIL-only "your phone number was changed" alert
(not SMS, an alert meant to catch an unauthorized change would not
reliably reach anyone by texting the number that just changed). Email
itself has no edit route anywhere, on purpose, changing it needs the
service-role client and a confirmation step and stays an admin-only
capability (`updateInvestor`, `lib/actions/investors.ts`) for now.

**Not built yet**: everything else. Every other screen the mobile app
needs for the staff, agent, and driver portals (a dashboard, fleet
list, whatever comes after the investor reference screen) needs its
own `app/api/v1/...` route, following the same pattern:
`authenticateApiRequest`, a permission check via the existing
`lib/rbac` helpers, then the existing `lib/data` function a web page
already calls. Beyond the two mutation routes above, no other
`lib/actions/*.ts` Server Action has a matching Route Handler yet.

### The keke-mobile app itself (Module 36)

Scaffolded as `keke-mobile`, a sibling folder next to this one under the
same connected root, not a subfolder of this repository. Expo (managed
React Native, TypeScript, `expo-router` file-based routing), created
with `create-expo-app`. See `keke-mobile/README.md` for setup and its
own "what is here right now" section; the short version:

- Real email/password sign-in against this app's own Supabase project,
  session persisted on-device via a custom `expo-file-system` storage
  adapter (`src/lib/file-storage.ts`). Not
  `@react-native-async-storage/async-storage`, the package Supabase's
  own docs recommend, its native module doesn't resolve in Expo Go on
  Expo SDK 57's bridgeless runtime, even pinned to the exact version
  Expo Go bundles for that SDK, see `keke-mobile/src/lib/file-storage.ts`'s
  own comment for the full reasoning if this needs revisiting once the
  ecosystem catches up to SDK 57.
- Calls `GET /api/v1/me` after sign-in to resolve the portal and show
  the real signed-in user's name/email/phone/portal on a working
  Profile tab, with working sign-out.
- Home, Fleet, and Wallet tabs exist but Fleet and Wallet are
  placeholders, honestly labeled "coming soon", no backing endpoint
  for either exists yet.
- The sign-in screen's "send a login link by email" button is visible
  (matches the approved design) but intentionally inert for now, see
  the magic-link gap below.
- Brand colors, radius, and shadow tokens are duplicated by hand in
  `keke-mobile/src/constants/theme.ts` from this app's
  `app/globals.css`. There is no shared source between the two
  projects, if a token changes here, it needs updating there too.

### The mobile app's investor dashboard (Module 37)

- Home, Fleet, and Wallet now show real data, but only for the
  investor portal: they call `useInvestorSummary()`
  (`keke-mobile/src/hooks/use-investor-summary.ts`), a small hook
  wrapping `fetchInvestorSummary()` (`GET /api/v1/investor/summary`
  above), and every screen checks `profile?.portal === 'investor'`
  before rendering any of it. Staff/agent/driver accounts still see
  the Module 36 "coming soon" placeholders, since there is no
  equivalent endpoint for those portals yet.
- Home shows stat tiles, a wallet-balance card, an animated bar
  sparkline for the last 8 weeks of payouts (`PayoutTrendChart`,
  a hand-rolled substitute for the web dashboard's
  `<AreaTrendChart>`, no charting library was worth adding for one
  mobile screen), a first-vehicle summary, and a recent-payments
  recap. Fleet lists every vehicle with its progress bar, a
  plate/frame/start-date spec band, and a driver card. Wallet shows
  the balance and the full recent-payments list. All three match the
  web dashboard's own empty-state and error copy rather than
  inventing new wording.
- The sign-in screen's password field now has a show/hide toggle
  (`EyeIcon`/`EyeOffIcon` in `src/components/icons.tsx`), and the
  sign-in screen plus the Home/Fleet/Wallet cards use
  `react-native-reanimated` entrance animations and an
  `AnimatedPressable`/`AnimatedProgressBar` pair for press feedback
  and animated progress fills, see the Module 37 README entry for
  the reasoning behind the one `eslint-disable` this needed.

### The mobile app's vehicle icons, payment split, and Security screen (Module 38)

- **Vehicle-type icons restored.** `src/components/vehicle-icons.tsx`
  adds `CarIcon`/`BikeIcon` (same stroke-based style as
  `src/components/icons.tsx`) alongside the existing `KekeIcon`, and a
  `VehicleTypeIcon` dispatcher that picks the right one from a
  vehicle's `type`. Both the Home vehicle summary card and every Fleet
  card now show a 44x44 accent-soft icon badge next to the vehicle's
  title, restoring what the Module 36 "coming soon" placeholder had
  (a big `KekeIcon` badge) but the real, data-backed cards lost when
  they replaced it in Module 37. Vehicle photos were never a real,
  data-backed feature (no field for one on `Vehicle` in
  `prisma/schema.prisma`, only in the static Module 36 mockup), so an
  icon badge is the actual fix here, not a photo upload feature.
- **Home and Wallet now correctly split recent vs. upcoming payments**,
  using the new `upcomingPayments[]` field above: Home shows an
  "Upcoming payments" section above "Recent payments" (only when there
  are any), Wallet shows the same two sections instead of one list
  that silently mixed both. Both use a new shared
  `src/components/payment-list-card.tsx` (`PaymentListCard`), pulled
  out of `index.tsx` where it started as a route-local export, so
  Home, Wallet, and any future screen render payment rows identically
  instead of keeping separate copies.
- **A new Security screen** (`src/app/security.tsx`), reached from a
  new "Settings" section on the Profile tab, a Stack route rather than
  a fifth tab (`src/app/_layout.tsx`) since it needs a real back
  button, not tab-bar chrome. Two sections:
  - **Password**: three fields (current, new, confirm) each with an
    eye-toggle, calling the new `POST /api/v1/auth/change-password`
    above via `changePassword()` in `src/lib/api.ts`.
  - **Two-factor authentication**: entirely client-side Supabase calls
    (`supabase.auth.mfa.enroll/challenge/verify/unenroll/listFactors`),
    no backend route needed, mirroring the web app's own
    `components/account/mfa-settings.tsx`. On enroll, Supabase returns
    `data.totp.qr_code` already wrapped as a
    `data:image/svg+xml;utf-8,<svg .../>` URI (confirmed from
    `@supabase/auth-js`'s own source, not just its `.d.ts` comment);
    that prefix is stripped back off and the raw SVG markup handed to
    `react-native-svg`'s `SvgXml`, since React Native's built-in
    `<Image>` can't decode SVG. A manual-entry secret is shown
    alongside the QR code as a fallback. Turning MFA off asks for
    confirmation first (`Alert.alert`), matching how sign-out already
    asks.
- **The Home dashboard's payout chart rebuilt**
  (`src/components/payout-trend-chart.tsx`): was a plain bar
  sparkline (Module 37), now an animated SVG line with a
  gradient-filled area underneath, closer to the web dashboard's own
  `<AreaTrendChart>`. `react-native-reanimated`'s `useAnimatedProps`
  drives a `strokeDashoffset` sweep (the line "draws in") and a
  `fillOpacity` fade on mount, `react-native-svg`'s `Path`/`Line`/
  `Circle`/`LinearGradient` do the drawing. Still hand-rolled rather
  than a charting library, same reasoning as Module 37: not worth
  adding a dependency for one mobile screen.

### Payment History, phone number settings, and two Module 38 confirmations (Module 39)

- **A new Payment History screen** (`src/app/payment-history.tsx`,
  another Stack route like Security), reached from a "Full history →"
  link on Home (previously pointed at the Wallet tab, which is itself
  still a capped preview, not the uncapped list) and a "View full
  payment history" button on Wallet. Calls the new
  `GET /api/v1/investor/payments` above through
  `fetchInvestorPayments()` (`src/lib/api.ts`). Five preset range chips
  (all time, this month, last 3/6 months, this year) plus a month
  stepper for jumping to one specific month, no native date-picker
  dependency added, month-level granularity is enough for weekly
  installment payments and matches how this app already prefers
  hand-rolled UI over a new package (see the payout chart above).
  Results render through the same `PaymentListCard` Home and Wallet
  use, sliced client-side 20 at a time behind a "Show more" button
  rather than a real paginated fetch, an investor's full history is a
  few hundred rows at most, not worth cursor-based pagination for. A
  `requestIdRef` guards against an in-flight request's result landing
  after a newer filter's request already resolved.
- **A "Phone number" card added to the Security screen**, above
  Password: a single field and a Save button, calling the new
  `POST /api/v1/auth/update-phone` above through `updatePhoneNumber()`
  (`src/lib/api.ts`). No corresponding change on email anywhere on this
  screen, on purpose, see that route's own comment.
- **Two things confirmed rather than changed**, after feedback that
  turned out to already be accurate once checked against the running
  code:
  - The Fleet and Home vehicle badges already dispatch on the
    vehicle's real `type` (`VehicleTypeIcon`, `src/components/vehicle-icons.tsx`):
    a `CAR` vehicle gets `CarIcon`, a `BIKE` vehicle gets `BikeIcon`,
    neither is the `KekeIcon` mark. This was already true as of Module
    38, nothing needed to change, the concern most likely came from an
    investor account whose contracts happen to all be `KEKE` type
    vehicles (the demo investor account is one such account), which
    would only ever show the keke sketch, correctly, having never had a
    `CAR`/`BIKE` contract to render differently.
  - The Home dashboard's payout chart's numbers come from the exact
    same `payoutTrend` object `getInvestorDashboardData` computes via
    `buildWeeklyTrend` (`lib/data/chart-helpers.ts`), the same shared
    function and the same underlying `PaymentTransaction` query the web
    dashboard's own chart uses, scoped to this investor's outbound
    payouts over the last 8 calendar weeks. Module 38 changed only how
    that data is drawn (an animated SVG line instead of a bar
    sparkline), never what feeds it, there was no separate computation
    introduced to double-check.

### A header spacer visual fix (Module 40)

The Security and Payment History screens each center their title with
`justifyContent: 'space-between'`, which needs an equal-width element
on the right balancing the real back button on the left. That
placeholder reused `backBtn`'s own style (a bordered white circle),
which then rendered as what looked like a second, unlabeled button
that did nothing, flagged directly from a screenshot. Both screens now
use a separate `headerSpacer` style, same size, no border, no
background, genuinely invisible. Purely visual, nothing was ever
tappable there.

### Investor bank change requests and deposit accounts (Module 41)

Direct feedback: an investor's own payout account number wasn't visible
anywhere in the app, and changing it should go through staff approval
like everything else that touches money, not save instantly. Separately,
investors had no deposit account of their own at all, even though the
same Paystack Dedicated Virtual Account pattern already used for
agent/driver collections was the obvious fit, and no way to say whether
a deposit was "just top up my wallet" or "I'm buying a vehicle, please
act on this."

- **Bank account changes are now maker-checker**, the same shape as a
  wallet withdrawal. `InvestorBankChangeRequest` (new model) moves
  through `PENDING_APPROVAL -> APPROVED`/`REJECTED`, or investor-initiated
  `CANCELLED`. `updatePayoutDetails`, which used to save the investor's
  bank account instantly, is retired; `requestPayoutDetailsChange`
  (`lib/actions/investor-profile.ts`) creates a request instead (still
  resolves the account with the bank first, exactly like the old
  instant-save path did, an unresolvable account is refused before it
  ever reaches a staff member). `approveBankChangeRequest`/
  `rejectBankChangeRequest` (`lib/actions/investors.ts`, gated
  `investors.manage`) are where a staff member decides, from a new queue
  page `/admin/wallet/bank-change-requests` (linked as a third card from
  `/admin/wallet`), approving writes the new
  `bankAccountNumber`/`bankAccountName`/`bankCode` onto `InvestorProfile`
  inside a transaction with the request update. `/investor/payout-details`
  shows the account on file, a pending request with a cancel button, and
  the outcome (with any review note) of the last decided one. Only the
  bank account/number itself needs approval this way, not
  `defaultPayoutDestination` (bank vs. wallet), that stays the instant,
  self-service toggle it already was (`updatePayoutDestination`,
  unchanged), a deliberate scope decision, the project owner's own
  answer when asked: changing where a payout defaults to going carries no
  fraud risk on its own, only the destination account number does.
- **Every investor now gets a Paystack Dedicated Virtual Account of
  their own**, `provisionInvestorCollectionAccount`
  (`lib/payments/collection-account.ts`), structurally identical to the
  agent/driver version described under "Payments" above, called from
  `createInvestor` (`lib/actions/investors.ts`) and, for every investor
  created before this module, retryable from a "Deposit account" card on
  `/admin/investors/[id]` the same way agent/driver provisioning already
  had a retry button. The account number and bank land on
  `InvestorProfile.paystackDvaAccountNumber`/`paystackDvaBankName`, shown
  to the investor on `/investor/wallet`.
- **A deposit into that account always credits the wallet, it never
  creates a contract on its own.** `handleChargeSuccess`
  (`lib/payments/webhook-handler.ts`) now also checks incoming
  `charge.success` events against `InvestorProfile.paystackCustomerCode`
  (after the existing agent/driver checks find no match) and, on a hit,
  runs the new `handleInvestorDeposit`: records a `PaymentTransaction`
  with the previously-unused `PaymentSource.INVESTOR_FUNDING` (the
  `SOURCE_LABEL` map already had an entry waiting for this, see
  `lib/data/reports.ts`), credits `InvestorProfile.walletBalance`, and
  writes a `WalletTransaction` with the new `WalletTransactionSource.DEPOSIT`.
  This is a system-recorded credit, not a staff approval, the same
  reasoning `PAYOUT_HELD` already had: the payment rail already confirmed
  real money moved, there is nothing left for a human to decide about
  *that* part. What still never happens automatically, unchanged from
  before this module (see "Locked business rules" above): turning that
  wallet balance into a new vehicle's contract, that is still always a
  staff decision made explicitly at `/admin/wallet/funding/[investorId]`.
- **A standing "what are deposits for" preference**, direct feedback:
  "when depositing it should ask investor if he wants to fund his wallet
  or he wants to purchase the vehicle straight away." `InvestorProfile`
  gained `depositIntent` (`WALLET_TOPUP` default, or `VEHICLE_PURCHASE`)
  and `depositIntentVehicleType`, editable any time from a
  `DepositIntentForm` on `/investor/wallet`
  (`updateDepositIntent`, `lib/actions/investor-profile.ts`). Every
  deposit snapshots the investor's intent at the moment it lands onto the
  new `WalletTransaction.depositIntent`/`.depositIntentVehicleType`
  fields, so a later preference change never rewrites history. Choosing
  `VEHICLE_PURCHASE` does not create or reserve anything by itself, it
  only flags the deposit: `getWalletFundingCandidates`
  (`lib/data/wallet.ts`) now surfaces a "Wants a {vehicle type}" badge
  per candidate on the existing `/admin/wallet/funding` staff screen, so
  a staff member can act on it quickly through the same manual funding
  flow that already exists, same invariant preserved as above.
- **`keke-mobile` gets the same two features**, five new
  `app/api/v1/*` routes on the web side following the existing
  sibling-implementation pattern (a plain read function reused directly
  for a `GET`, a hand-mirrored reimplementation for a `POST`, see
  "Mobile / external API" above): `GET /api/v1/banks` (the bank picker
  list), `GET`/`POST /api/v1/investor/bank-change-request` (latest
  request plus the account on file / submit a new request),
  `POST /api/v1/investor/bank-change-request/cancel`,
  `GET /api/v1/investor/deposit-account`, and
  `POST /api/v1/investor/deposit-intent`. Two new Stack routes on the
  mobile app, the same pattern as Security/Payment History:
  `src/app/bank-account.tsx` (current account, a pending/declined
  request banner, a bank-picker-plus-account-number form behind a
  hand-rolled searchable `Modal`/`FlatList` picker, no new picker
  dependency added, matching this app's established preference for
  hand-rolled UI over a new package) and `src/app/deposits.tsx`
  (deposit account number/bank, wallet balance, and the same
  wallet-top-up-vs-vehicle-purchase radio choice as the web form).
  Reached from a new "Bank account" row in the Profile tab's Settings
  section (investor accounts only) and a new "Deposit account and
  top-up preference" link on the Wallet tab.

### Icons, dark mode, chart fix, and Profile/Security cleanup (Module 42)

A batch of direct feedback covering both apps: vehicle imagery missing on
web, generic stat-card icons, a production error on
`/investor/payout-details`, a chart overflowing its card, no dark mode,
no screen rotation, web responsiveness, phone number's placement, and
animation polish.

- **`/investor/payout-details`'s "Something went wrong" error was
  diagnosed, not fixed in code.** Every Server Action the page depends on
  (`lib/actions/investor-profile.ts`) was re-read line by line, the
  `Badge` variant it uses was confirmed valid, and the page's own markup
  matches the generic per-route `app/error.tsx` boundary exactly. The
  most likely cause is that migration
  `prisma/migrations/20260903130000_add_investor_deposits_and_bank_change_requests`
  (Module 41's schema) exists on disk but was never applied to the live
  database, this sandbox has no way to run `prisma migrate deploy` or
  reach the database directly. Apply that migration (or paste its SQL
  into the Supabase SQL editor) and this should resolve; if it does not,
  the production error digest and what was being clicked when it
  happened are the next things to capture.
- **Vehicle images now show on the web app.** New
  `components/design-system/vehicle-illustrations.tsx`, a browser port of
  the mobile app's `VehicleTypeIllustration` family (same coordinates,
  same palette, plain `<svg>` instead of `react-native-svg`), wired into
  the investor dashboard's "My vehicles" cards and
  `components/fleet/keke-card.tsx`. The existing small single-tone
  `VehicleTypeIcon` (`vehicle-icons.tsx`, unchanged) stays correct for
  compact badges (fleet detail headers, driver dashboard tiles), it was
  never meant to be a full illustration.
- **Real icons on the investor dashboard's four stat cards.** They
  previously shared one generic recolored vertical line
  (`<path d="M12 2v20" />`). New `components/design-system/stat-icons.tsx`:
  `InvestedIcon` (a stacked coin cylinder), `RealizedIcon` (a coin
  dropping into a tray), `OutstandingIcon` (a plain clock),
  `PortfolioIcon` (a briefcase, replacing a house glyph that misleadingly
  suggested real estate). `keke-mobile`'s `src/components/icons.tsx`
  gained the same four, wired into the Home screen's `StatTile`
  (`src/app/(app)/index.tsx`) with a small tinted icon badge per tile.
- **The payout trend chart no longer overflows its card on the web
  app.** `components/charts/area-trend-chart.tsx` used to size its
  `<svg>` with an explicit pixel `height` inside a `w-full` box; under
  some layout contexts the rendered box could drift from the SVG's
  intended aspect ratio. It now renders inside a `<div className="aspect-[14/5]
  w-full">` wrapper with `preserveAspectRatio="none"` on the `<svg>`,
  which structurally caps the rendered box to that ratio regardless of
  context. `keke-mobile`'s `payout-trend-chart.tsx` was checked against
  the same report and does not reproduce it: `<Svg width="100%"
  height={HEIGHT} .../>` gives RN's Yoga layout an explicit, definite
  height regardless of the parent `<View>`, unlike a web `<svg>` whose
  height can be left to flow from context. No mobile change was needed.
- **Light/dark mode, both apps.** Web: every color in `app/globals.css`
  already routed through a `--custom-property` (aliased into Tailwind's
  `@theme inline` block), so dark mode is a second definition of the
  same property names under `[data-theme="dark"]` and a `@media
  (prefers-color-scheme: dark)` fallback, warm charcoal (close relatives
  of the existing `--accent-charcoal`) rather than a generic near-black,
  so it reads as this app's own palette turned down. A
  `beforeInteractive` `next/script` in `app/layout.tsx` sets the
  attribute before first paint (saved `localStorage` choice, else OS
  preference, else light), and `components/layout/theme-toggle.tsx`
  (a sun/moon button, wired into `AppShell` so every logged-in page has
  it) flips it after that; it reads its state with
  `useSyncExternalStore` rather than `useState`/`useEffect`, since the
  real value lives on the DOM, an external system, not in local
  component state, sidestepping a lint rule
  (`react-hooks/set-state-in-effect`) that flagged an earlier
  mount-time-effect version. A universal `*, *::before, *::after`
  transition rule (background/border/color/fill/stroke only, never
  `transform`/`opacity`) smooths the flip everywhere without fighting any
  existing entrance animation.

  Mobile: `src/constants/theme.ts` used to export one static `Colors`
  object; it now exports `LightColors`/`DarkColors` (a `ColorPalette`
  interface) and `Colors` no longer exists at all, a deliberate breaking
  change used as a compiler-driven checklist (`npx tsc --noEmit` surfaces
  every remaining consumer as an error). New
  `src/context/theme-context.tsx` provides `useTheme()`: `scheme`
  resolves from an explicit `preference` (`'light' | 'dark' | 'system'`)
  or, when `'system'`, from `useColorScheme()`; the explicit preference
  persists through the existing `FileSystemStorage` helper
  (`src/lib/file-storage.ts`, the same one `src/lib/supabase.ts` already
  uses for its own auth session), specifically because
  `@react-native-async-storage/async-storage`'s native module doesn't
  resolve under this project's Expo SDK 57 bridgeless runtime inside
  Expo Go, a constraint this codebase already had before this module.
  Every screen and shared component that read the old `Colors` import
  was migrated to call `useTheme()` and compute its `StyleSheet.create`
  inside a `useMemo(..., [colors])` (or, where several sibling
  components shared one style object, a `createStyles(colors)` factory
  function), so a screen's styling now actually re-renders when the
  theme changes rather than being frozen at whatever was true on first
  mount. `ThemeProvider` wraps the whole app in `src/app/_layout.tsx`,
  above `AuthProvider`, so every route, signed in or not, can call
  `useTheme()`. The user-facing control is a new "Appearance" card
  under Settings on the Profile tab (`AppearanceSection`,
  `src/app/(app)/profile.tsx`): a System/Light/Dark three-way segmented
  tab, the same look as the sign-in screen's investor/staff tabs,
  calling `setPreference()`.
- **Screen rotation is enabled on the mobile app.** `app.json`'s
  `expo.orientation` changed from `"portrait"` to `"default"`.
- **The web app is now responsive.** `components/layout/app-shell.tsx`
  (used by every logged-in page across every portal) was a fixed 240px
  sidebar with no narrower layout at all; below the `lg` breakpoint it is
  now an off-canvas drawer (`AppShell` moved from a Server to a Client
  Component for the drawer's open/closed state) behind a hamburger button
  in a new mobile-only top bar, closing itself automatically on
  navigation (comparing the current and last-seen `pathname` during
  render, not a `useEffect`, for the same set-state-in-effect reason as
  the theme toggle above). An audit of the rest of the app (grid
  breakpoints, large fixed pixel widths, table scroll wrappers) found the
  existing page-level conventions already responsive; the shell was the
  one real structural gap.
- **Phone number moved from Security to Profile on the mobile app**,
  direct feedback that it doesn't belong next to password and two-factor
  authentication. `src/app/security.tsx` now covers only
  `PasswordSection`/`MfaSection`; the phone number editor
  (`PhoneSection`) moved to `src/app/(app)/profile.tsx`. The web app has
  no equivalent "Profile" destination in its current navigation (its
  settings live under `/change-password` and portal-specific pages), so
  this move was scoped to mobile only; an equivalent web restructure
  would need a decision on where a Profile page belongs in the existing
  sidebar navigation before building one.
- **Animation polish**: the mobile app's `src/app/index.tsx` (the
  "decide sign-in vs. app" gate, shown while auth state resolves) now
  scales and fades in the Ultimate mark instead of a bare spinner on a
  blank background, and the root `Stack` in `src/app/_layout.tsx`
  cross-fades between `index`/`sign-in`/`(app)` (`animation: 'fade'`)
  instead of the platform-default horizontal push, covering both "login
  in" and "login out" since signing out lands back on `sign-in` through
  the same transition. The `presentation: 'card'` settings sub-pages keep
  their native slide-up sheet animation, unchanged, that already reads
  correctly as "a page opened on top of where you were." On the web,
  `/sign-in` and `/admin-sign-in` gained a short entrance animation on
  first paint (new `.animate-slide-in-left`/`-right`/`.animate-card-in`
  usage in `app/globals.css`), the same page `SignOutButton` redirects
  back to on sign-out.

**Module 42 follow-up fixes**, found testing the delivered batch above:

- **A real crash on the mobile Profile screen**: `[expo-router]: You are
  passing an array of styles to a child of <Slot>`. `expo-router`'s
  `<Slot>` (what `<Link asChild>` renders) refuses an array `style` prop
  on its immediate child, it can only merge in its own injected style
  onto a single flattened object. The Security and Bank account rows in
  `src/app/(app)/profile.tsx` passed `style={[styles.settingsRow,
  styles.settingsRowSpaced]}` directly; fixed with
  `StyleSheet.flatten(...)`, the same pattern the Home screen's own
  wallet-balance link (`src/app/(app)/index.tsx`) already used, and now
  documented inline as the rule for any future `<Link asChild>` row on
  this screen.
- **The admin dashboard's seven stat cards** (Total vehicles, Active
  fleet, In maintenance, Investment value, and the three "this month"
  money-flow cards) all reused `KekeIcon`, the app's own logo mark,
  recolored per card, exactly the bug Module 42 had already fixed on the
  investor dashboard, just not caught on this page in the same pass.
  Six new icons in `components/design-system/stat-icons.tsx`
  (`FleetIcon`, a generic car silhouette since a fleet mixes vehicle
  types; `ActiveFleetIcon`, a speedometer; `MaintenanceIcon`, a wrench;
  `InflowIcon`/`OutflowIcon`, mirrored arrows into/out of a baseline;
  `NetIcon`, a balance scale) replace it in `app/admin/dashboard/page.tsx`;
  "Investment value" reuses `InvestedIcon` (the same coin-stack metaphor
  genuinely fits both concepts).
- **`/admin/reports`'s "Inflow by day"/"Outflow by day" charts were
  illegible**, reported as "the write-up is gibberish." `AreaTrendChart`
  (`components/charts/area-trend-chart.tsx`) renders one `<text>` label
  per entry in its `weeks` array; the dashboards' 8-week charts this
  component was built for never had enough points to crowd, but the
  reports page passes one label per day in the selected range (30 by
  default), 30 short date strings landing on top of each other in the
  same 540px of axis. A new `MAX_LABELS` cap (7) now evenly samples which
  indices actually get a `<text>` (always including the first and last),
  independent of how many points the line and area themselves plot.
- **The "last 8 weeks" charts showed a week number ("W34") instead of a
  date**, direct feedback: "add the date of payment not week count."
  `buildWeeklyTrend` (`lib/data/chart-helpers.ts`) is the single shared
  bucketing function behind the admin dashboard's "Realized payments,"
  the investor dashboard's payout trend (and, through
  `getInvestorDashboardData`, the mobile app's own payout trend chart),
  the agent dashboard's remittance trend, and the driver dashboard's
  deposit trend, so fixing it once fixes every one of them plus mobile:
  each bucket is now labeled with `dayLabel` (the same short "24 Aug"
  formatter the daily reports chart already used) on the date its week
  starts, instead of `weekLabel`'s ISO-week-ish form. `weekLabel` itself
  is untouched and still exported from `lib/utils.ts` (and still
  covered by its own test), it is simply no longer what
  `buildWeeklyTrend` calls.
- **Not reproduced**: a report that a chart "on the mobile dashboard" was
  "not covering the entire card." `src/components/payout-trend-chart.tsx`
  (the only chart on the mobile investor Home screen) sizes its `<Svg>`
  with an explicit `width="100%" height={HEIGHT}`, which should fill its
  card regardless of context, the same reasoning that already ruled out
  a mobile-side chart-overflow bug earlier in Module 42. No code change
  was made for this one without a screenshot to diagnose against.

**Module 42 follow-up fixes, round two**, from continued testing of the
batch above:

- **Resolved, was the "not reproduced" mobile chart item just above**:
  "the chart in the investor's dashboard has not change[d]." The backend
  date-label fix (`buildWeeklyTrend` now emitting `dayLabel`s) had reached
  `latestLabel`, the chart's single callout badge, which is why a later
  screenshot showed a real date there ("30 Aug"). But
  `PayoutTrendChart` never accepted a `weeks` prop at all, unlike its web
  sibling `AreaTrendChart`, so the axis itself stayed unlabeled and the
  chart looked untouched next to the web dashboard's now-dated one.
  `weeks` is now required and rendered along the baseline (`MAX_LABELS =
  4`, same even-sampling approach as the web component, using
  `react-native-svg`'s `<Text>` under the alias `SvgText` to avoid
  colliding with RN's own `Text`), and `src/app/(app)/index.tsx`'s call
  site now passes `data.payoutTrend.weeks`.
- **The real bug behind "the upcoming payment...shows the date that have
  already gone": `mapScheduleStatus` in `lib/data/investor.ts` collapsed
  UPCOMING/DUE/PARTIALLY_PAID into one "UPCOMING" bucket with no check
  against the entry's `dueDate`.** `ScheduleEntryStatus`
  (`prisma/schema.prisma`) has no OVERDUE value to read this off of
  directly, PAID and DEFERRED are the only statuses that mean "this entry
  is settled," everything else is either still ahead or already late
  purely as a function of `dueDate` vs. "now." `mapScheduleStatus` now
  takes `(status, dueDate, now)` and returns a fourth possible value,
  OVERDUE, when the due date has passed and the entry was never paid or
  deferred. `now` is computed once per function call and threaded through
  every entry in that request rather than called fresh per comparison, so
  every entry in one response is judged against the same instant.
  - `getInvestorDashboardData`'s `upcomingPayments` filter (`status ===
    "UPCOMING"`) needed no change, only what counts as UPCOMING upstream
    did; it now correctly excludes anything overdue.
  - A new `overduePayments` array (oldest due date first, capped at 6,
    same shape as `recentPayments`/`upcomingPayments`) is returned
    alongside them, and reaches mobile automatically since
    `/api/v1/investor/summary` reuses this exact function.
  - `getInvestorPaymentHistory` (the full, uncapped list behind
    `/investor/payments` and mobile's Payment History screen, and the
    per-vehicle screen below) needed the identical one-line change to its
    own copy of the entry-mapping logic; a late entry now reads OVERDUE
    there too instead of silently reading UPCOMING forever.
  - A contract-level "is any of this vehicle's payments overdue" check
    (`hasOverdueDue`, same shape as the existing `hasDeferredDue`) was
    added to both `getInvestorDashboardData`'s `vehicles` list and
    `getInvestorInvestments`, producing a third vehicle status,
    `PAYMENT_OVERDUE`, alongside the existing `ACTIVE`/`PAYMENT_DEFERRED`
    (`PAYMENT_DEFERRED` wins if both are true, a staff-acknowledged
    deferral is a different situation from a payment nobody has dealt
    with). Every place that already branched on that status string (web
    dashboard, `/investor/investments`, mobile Home's new vehicle
    carousel, the Fleet tab, and the new vehicle detail screen) now has a
    third branch, badged "Payment overdue" in the `bad`/red tone.
  - UI additions that read the two new fields: a "Missed payments"
    section on the web and mobile investor dashboards (only rendered when
    `overduePayments.length > 0`), a "Missed" badge and a small missed
    count call-out on `/investor/payments`, and the equivalent on mobile's
    Payment History and vehicle detail screens via
    `payment-list-card.tsx`'s updated tone/label helpers.
- **Verified, not a bug: payment schedule generation already respects
  each contract's actual frequency.** `lib/schedule.ts`'s
  `generateScheduleDates` branches on `frequency` (WEEKLY/BIWEEKLY/
  MONTHLY) per call, it was never hardcoded to weekly, `lib/schedule.test.ts`
  already covers the biweekly and monthly paths. The platform has no
  "daily" frequency at all, only those three values
  (`PaymentFrequency` in `prisma/schema.prisma`). What genuinely was
  wrong, and is now fixed, is display, not calculation: every payment row
  labeled itself "Week N" regardless of the contract's actual cadence
  (`week` is really "this entry's position in its own contract's
  schedule," not literally a calendar week), now shown as "Payment N"
  everywhere across both apps, and the investor dashboard's/mobile Fleet
  screen's per-vehicle installment figure now labels itself
  Weekly/Biweekly/Monthly (`vehicles[].frequency`, newly returned from
  `getInvestorDashboardData`) instead of assuming weekly.
- **New: `updateVehicleStatus` action and a status `<select>` on
  `/admin/fleet/[id]`.** Direct feedback: "after clicking the fleet from
  the admin there is no place to change or set the fleet to maybe under
  maintenance those kind of settings." `createVehicle`
  (`lib/actions/fleet.ts`) only ever set a vehicle's `VehicleStatus` once,
  at creation; nothing else in the app could change it afterward, even
  though the fleet browser (`app/admin/fleet/fleet-browser.tsx`) already
  has a working MAINTENANCE filter chip and badge with nothing able to
  put a vehicle into that state. The new action (fleet-manage permission
  only) revalidates the vehicle's own detail page, the fleet list, and
  the admin dashboard.
- **New: a swipeable vehicle carousel replaces mobile Home's single
  vehicle card.** Direct feedback: "the fleet on the mobile dashboard
  should be like slide card that a user can be able to slide without
  necessary viewing all the fleet via the fleet tab." `src/app/(app)/index.tsx`'s
  "My vehicles" section used to render only `data.vehicles[0]` plus a
  "+N more on the Fleet tab" text note; it now renders every vehicle as
  its own card in a horizontal `ScrollView` with `snapToInterval` paging,
  each card sized to `windowWidth - 20*2 - 24` (via `useWindowDimensions`,
  not a one-time `Dimensions.get`, so this stays correct across the
  rotation support Module 42 already added) so the next card peeks in at
  the trailing edge as a swipe affordance.
- **New: a per-vehicle payment history screen, `src/app/vehicle-detail.tsx`.**
  Direct feedback: "on clicking on a particular vehicle an user should be
  able to see all the history of the vehicle like payment received and
  date from the beginning of the contract." A Stack route (registered in
  `src/app/_layout.tsx`, `presentation: 'card'`, same reasoning as
  `payment-history.tsx`: a real back button, reached from more than one
  place), opened via `<Link href={{ pathname: '/vehicle-detail', params:
  { assetTag } }}>` from either the new Home carousel or a Fleet tab
  card. No new API route: `useInvestorSummary()` (already shared by
  Home/Fleet/Wallet) supplies this vehicle's contract terms, and a fresh,
  unfiltered `fetchInvestorPayments()` call is filtered client-side to
  entries whose `vehicle` field matches this `assetTag`, the same list
  the cross-vehicle Payment History screen already fetches in full.

**Module 42 follow-up fixes, round three**, from continued testing of round
two's delivery (two screenshots: the mobile investor Home dashboard, and the
web admin dashboard at `/admin/dashboard`):

- **The web admin dashboard's "Realized payments" chart still read as
  not filling its card, on a wide desktop screen this time** (the
  mobile-only version of this same complaint, from round one, is now
  understood too, see the `PayoutTrendChart` entry above). The wrapper
  around `AreaTrendChart`'s `<svg>`
  (`components/charts/area-trend-chart.tsx`) sized itself purely by
  `aspect-[14/5]` (14:5, matching the `viewBox`'s 560:200), height
  following width at that fixed ratio with nothing capping it. That
  looks right on a narrow card, but this chart's card runs the admin
  dashboard's full content width, roughly 930px in the reported
  screenshot, and 930 × 5⁄14 ≈ 330px is a tall box for a small trend
  line. The actual bug: `chartMax` (the y-axis scale) is set to the
  *data's own highest point*, not to the box's full height, so on a week
  where most values sit well below that peak, most of a 330px-tall box
  sits blank above the line, which reads as "the chart isn't filling
  the card" even though technically nothing is broken or clipped, unlike
  round one's genuine overflow bug. Fix: `max-h-[200px]` added alongside
  the existing `aspect-[14/5] w-full`, capping the box at the SVG's own
  native 200px viewBox height no matter how wide its card gets; a
  narrower card, still under that cap, is completely unaffected. This is
  only safe because of the round-one fix already in place:
  `preserveAspectRatio="none"` lets the `<svg>` stretch to fill any box
  non-uniformly (independent x/y scale factors) without distortion or
  clipping, so capping height while width keeps growing does not
  reintroduce the overflow bug that fix closed.
- **The admin dashboard's search bar was entirely decorative**: a plain
  `<div>` with a magnifier icon and placeholder text
  (`app/admin/dashboard/page.tsx`), no `<input>` element at all, nothing
  behind it could ever be clicked or typed into. Two new files:
  `lib/actions/search.ts` (`searchAdmin`, a Server Action, not a new
  `/api` route, matching how every other admin mutation in this app
  already works) queries investors (name/email, case-insensitive
  `contains`), vehicles (asset tag/plate/frame number), and payment
  batches (period label) in parallel, each section skipped entirely
  unless the signed-in staff member holds that section's own `*_VIEW`
  permission (`INVESTORS_VIEW`/`FLEET_VIEW`/`PAYMENTS_VIEW`, the same
  gate `/admin/investors`, `/admin/fleet`, and `/admin/payments/batches`
  already enforce, a search box should never surface a result someone
  couldn't otherwise reach), capped at 5 rows per section, and only run
  once the query is 2+ characters. `components/admin/global-search.tsx`
  (`"use client"`, a small island inside the otherwise server-rendered
  dashboard page, the only way to hold input state there) debounces
  keystrokes 250ms, discards a stale response via a monotonically
  increasing request id (same pattern as keke-mobile's
  `payment-history.tsx`), and renders a dropdown grouped by section, each
  row a `<Link>` straight to `/admin/investors/[id]`, `/admin/fleet/[id]`,
  or `/admin/payments/batches/[id]`; a click outside the box (a
  `mousedown` listener on `document`) or Escape closes it.

**Module 42 follow-up fixes, round four**, from continued testing of round
three's delivery ("it brings out the investor's name, but after clicking
the investor names it leads to no where"):

- **`/admin/investors/[id]` was too sparse to feel like a real
  destination.** `getInvestorById` (`lib/data/onboarding.ts`) originally
  returned only the account fields `InvestorEditForm`/`InvestorBankForm`
  needed to edit, an investor clicked from search landed on a page with
  no sign of their actual investments or payment history at all. Direct
  feedback asked for "that investor entire history with the company,
  his/her investment, payment history, his bank account and other
  details literally everything about him/her." `getInvestorById` now
  also loads every contract (`include: { vehicle, scheduleEntries }`)
  and returns: `investments` (one entry per contract, with the vehicle,
  contract status, principal/target/realized amounts, a computed
  progress percent, installment, frequency, term, and start date) and
  `paymentHistory` (every schedule entry across every contract, newest
  due date first, each one run through `mapScheduleStatus(status,
  dueDate, now)`, the exact same function `getInvestorDashboardData`
  uses for the investor's own dashboard). Reusing that function here
  rather than re-deriving OVERDUE/PAID/DEFERRED/UPCOMING separately is
  deliberate: a payment must read the same way to staff looking at
  `/admin/investors/[id]` as it does to the investor themselves looking
  at their own dashboard, one schedule entry, one status, everywhere it
  is shown. `totalInvested`, `totalRealized`, and `totalOutstanding` are
  also new, summed across all of the investor's contracts. The page
  (`app/admin/investors/[id]/page.tsx`) gained a 4-up stats grid, an
  "Investments (N)" card with one sub-card per contract (vehicle name
  linked to `/admin/fleet/[id]`, a `<Progress>` bar, and its figures),
  and a "Payment history (N)" card holding a scrollable `<Table>` of
  every entry with a status badge (`OVERDUE` reads "Missed," matching
  the investor-facing wording), inserted above the pre-existing edit
  form, password reset, and bank/deposit account sections, none of
  which changed.
- **Whether this was ever a genuine navigation bug, as opposed to the
  destination page simply looking like it went nowhere, could not be
  conclusively settled by reading code alone.** This sandbox has no live
  browser or dev server to reproduce a reported click against, so
  several candidate causes were checked against the actual code and
  ruled out by comparison rather than by reproduction: a permission
  mismatch between `searchAdmin`'s gating and the detail page's own
  gating (both read the same `INVESTORS_VIEW` permission, confirmed
  identical), a `z-index`/stacking overlap eating the click (the
  dropdown is the topmost `z-20` element in its own stacking context,
  nothing else in the page overlaps it), and a `mousedown`-before-`click`
  race between the outside-click handler and the result link's own
  click (the outside-click handler checks `containerRef.current`, which
  still contains the dropdown and its links at the moment of the
  `mousedown`, so it should not fire on a click headed at a result).
  Since none of that ruled in a confirmed bug, but none of it fully
  ruled one out either, `components/admin/global-search.tsx` picked up
  one more defensive layer regardless: a `usePathname()`-keyed effect
  that resets the dropdown's open/query/results state only once the URL
  has genuinely changed (guarded against firing on the very first
  render), sitting alongside, not instead of, each result `<Link>`'s own
  `onClick={closeAndReset}`. This closes off any remaining theoretical
  timing race regardless of whether one was ever actually happening.
  Combined with the page rebuild above, the click should now lead
  somewhere worth arriving at either way. If it still visibly does
  nothing after this, the next thing worth checking is something this
  sandbox cannot see from code, a browser console error on click, or a
  dev server that needs restarting to pick up these changes.

**Module 42 follow-up fixes, round five**, from the actual error screenshots
the round four delivery produced (a dev error overlay and two console errors,
sent directly rather than a description of the symptom):

- **Resolved the open question from round four: the click was never
  broken, the destination page was throwing.** The screenshot showed
  Next.js's own "Something went wrong" dev error overlay, which only
  renders when a Server Component throws during render, this rules out
  every click/navigation-timing theory considered in round four, the
  page genuinely never finished rendering. The thrown error: `Cannot
  read properties of undefined (reading 'findFirst')` at
  `getLatestBankChangeRequest` (`lib/data/onboarding.ts`), on
  `prisma.investorBankChangeRequest`. That model
  (`model InvestorBankChangeRequest` in `prisma/schema.prisma`, migration
  `20260903130000_add_investor_deposits_and_bank_change_requests`) is
  real, correctly named, and already read the identical way from four
  other call sites in this codebase
  (`getBankChangeRequestQueue`/`getLatestBankChangeRequest` in the same
  file, and three call sites in `lib/actions/investor-profile.ts`), so
  this is not a code defect in this project. `prisma.investorBankChangeRequest`
  being `undefined` on a `PrismaClient` instance that otherwise works
  (the page got as far as `getInvestorById`'s own several Prisma calls
  first) means the Prisma Client actually loaded by whatever process is
  running `next dev` on that machine does not expose this model, either
  because `npx prisma generate` has not been re-run there since this
  particular migration was applied, or because the long-lived `next dev`
  process itself was started before that regeneration and is still
  holding the previously generated client in memory (`lib/prisma.ts`
  deliberately caches one `PrismaClient` instance across hot reloads in
  `globalForPrisma`, on purpose, for connection-pooling reasons covered
  elsewhere in this document, but that same caching means a stale
  generated client survives a hot reload rather than being replaced by
  it). This sandbox cannot confirm or fix this directly, `npx prisma
  generate` needs `binaries.prisma.sh`, which is blocked here (see the
  existing gap on this two sections down). Needs, on the machine actually
  running the app: `npx prisma generate`, then a full stop and restart of
  `npm run dev`, not just a hot reload, since the stale client is already
  loaded into that process's memory.
- **A second, unrelated issue in the same screenshots: a hydration
  mismatch reported on `<html>`'s `data-theme` attribute.** The Module 42
  theme-init script (`app/layout.tsx`'s `THEME_INIT_SCRIPT`,
  `strategy="beforeInteractive"`) sets `data-theme` on the real DOM node
  before React hydrates, specifically so a returning user with dark mode
  saved never sees a flash of the light palette first. That means the
  attribute the server actually sent and the attribute present at
  hydration time can never agree, since the server has no way to know a
  visitor's saved theme ahead of time, this is the well known, documented
  tradeoff of every "no flash of the wrong theme" script, not a defect in
  the theme logic itself (dark mode was otherwise working correctly).
  `<html>` now carries `suppressHydrationWarning`, the standard fix for
  exactly this pattern, it silences a mismatch only on `<html>`'s own
  attributes, nothing inside `<body>` is affected, so a real mismatch
  anywhere else in the tree would still be reported normally.
- **New: clickable feedback and animation on every search result,**
  direct feedback: "add some clickable effect and animations after
  clicking on the investor from the search bar." Two changes to
  `components/admin/global-search.tsx`. First, every result row (now
  factored into a shared `ResultRow` component instead of three near
  identical inline `<Link>`s) carries `active:scale-[0.97]`, the exact
  same CSS class `components/ui/button.tsx` already applies to every
  `Button` for the same reason documented there: it is a pure CSS
  `:active` pseudo-class, so it fires the instant a mouse or tap goes
  down, before any JavaScript runs, closing the gap between the physical
  click and any React state update. Second, clicking a result no longer
  calls `closeAndReset` and makes the dropdown disappear immediately;
  it now calls a new `navigateTo(rowKey)` that only marks that one row as
  "navigating," which highlights it with an accent-tinted background and
  a small spinner (`RowSpinner`, styled after `components/ui/button.tsx`'s
  own `Spinner`). The dropdown stays open, with that row visibly working,
  until the `usePathname()` effect (added in round four purely as a
  defensive backstop against a hypothetical click race) actually fires,
  which is the only thing that closes it now. This removes the
  round-four failure mode entirely: previously the dropdown vanished the
  instant you clicked, and if the next page took even a moment to
  render, there was a blank gap with nothing on screen to suggest
  anything had happened at all, which is exactly what "leads to no
  where" describes regardless of whether the destination page was
  actually broken underneath it.

**Module 42 follow-up fixes, round six**: direct ask, "go ahead and
finish the outstandings from the investor web/mobile then proceed to the
agent." Investor's one remaining item first, then the agent portal's
first real mobile screens.

- **Investor: mobile magic-link sign-in, the last "Known gap" item for
  this portal, closed.** New `POST /api/v1/auth/check-magic-link`
  (`app/api/v1/auth/check-magic-link/route.ts`) wraps
  `checkMagicLinkBlocked` (`lib/actions/auth.ts`) as a plain HTTP route,
  the same shape as every other `/api/v1` route except it deliberately
  skips `authenticateApiRequest`, there is no signed-in user at the point
  this needs to run, it takes an email straight from the request body
  instead. `keke-mobile`'s `sign-in.tsx` `handleMagicLink` was a
  hardcoded "not available yet" alert; it now calls this route, then
  `supabase.auth.signInWithOtp` only if the account isn't blocked, the
  identical two-step order `/sign-in`'s own magic-link button already
  uses on the web side, so an account with two-factor authentication
  turned on still can never receive a magic link that would skip its
  second factor, on either app now. New `checkMagicLinkBlocked` export
  in `keke-mobile/src/lib/api.ts` deliberately does NOT go through
  `apiFetch`, that helper throws its own 401 when there's no session yet,
  exactly the state this call happens in.
- **New: `GET /api/v1/agent/summary`** (`app/api/v1/agent/summary/route.ts`),
  the agent portal's first `/api/v1` route, closing one of the three
  "staff, agent, and driver portals still have no equivalent endpoint"
  gaps below, agent specifically (staff and driver still have none).
  Identical shape to `GET /api/v1/investor/summary`: `authenticateApiRequest`,
  403 if the account has no agent profile, otherwise
  `getAgentDashboardData` (`lib/data/agent.ts`, the same function
  `app/agent/dashboard/page.tsx` already calls) returned as JSON:
  `region`, `virtualAccount` (accountNumber/bankName or null if not yet
  issued), `weeklyTarget`, `paidThisWeek`, `assignedVehicles[]`
  (assetTag, type, driver, amount, date, status: PAID | PENDING, every
  vehicle currently assigned to the agent, not capped, the query behind
  it has no `take` limit), and `remittanceTrend` (same weeks/amounts/
  latestLabel/latestAmount shape `buildWeeklyTrend` produces everywhere
  else). No permission check beyond "does this account have an agent
  profile," same reasoning as the investor route: an agent can only ever
  see their own assigned vehicles and remittances.
- **New: the agent portal is real on `keke-mobile` now.** Home, Fleet,
  and Wallet previously showed the same generic "your dashboard is on
  its way" placeholder for every non-investor account. A new
  `useAgentSummary` hook (`src/hooks/use-agent-summary.ts`, the agent
  mirror of `useInvestorSummary`, loading `fetchAgentSummary` and shared
  by all three tabs) backs real content for agent accounts specifically
  now: Home (`AgentHome`, a new component in `(app)/index.tsx`, kept
  separate from `HomeScreen` itself since it needs nothing from that
  component's own scope) shows the agent's Paystack collection account
  (account number, bank name, remittance instructions, mirroring
  `deposits.tsx`'s existing account-number-box styling for the
  investor's own deposit account), this week's target vs. paid so far
  (a `StatusBadge` percent, good at 100%+, warn below), the 8-week
  remittance trend (`PayoutTrendChart`, reused as-is, just fed
  `remittanceTrend` instead of `payoutTrend`, same component, same
  `preserveAspectRatio="none"` fix from round six above applies), and up
  to 6 of the agent's assigned vehicles with a "View all" link to the
  Fleet tab. Fleet now shows the agent's complete vehicle list (all of
  `assignedVehicles`, already unfiltered from `getAgentDashboardData`,
  no separate paginated endpoint needed the way the investor's payment
  history has one). Wallet shows the same collection-account and
  target/paid content as Home, deliberate overlap, not a mistake: the
  investor's own Home and Wallet tabs already both show the wallet
  balance and a payments preview, the same "some content earns its place
  on more than one tab" reasoning applies here. Staff and driver accounts
  still see the original placeholder, neither portal has a backing
  endpoint yet, see the gap below.

**Module 42 follow-up fixes, round seven**: direct ask, "on the staff, i
dont know if it is a good idea to have them use the mobile app... staff
or admin should use the webapp" plus "complete or finish up the agent,"
"finish up the investor too," and "make sure this web/mobile app are
very secure against attack... fix the password stuff too." Four pieces
of work, this entry covers the first.

- **Product decision, agreed with the project owner's own instinct and
  taken further: staff and admin accounts can no longer use
  `keke-mobile` at all, not even to see empty placeholder tabs.**
  Nothing about a staff or admin account's work is mobile-first the way
  an investor, agent, or driver's is, and every extra place a
  privileged, permission-bearing session can exist is attack surface
  worth removing rather than leaving dormant. `GET /api/v1/me`
  (`app/api/v1/me/route.ts`) now returns `403
  STAFF_PORTAL_NOT_SUPPORTED` for a staff/admin account instead of that
  account's profile. This is the one route that actually mattered:
  every other `/api/v1` route already only returns data for whichever
  of investor/agent/driver the caller has (403 otherwise), so a
  staff-only bearer token already got nothing real from any of them,
  this closes the one route that still would have handed back a staff
  account's full name, email, phone, and complete RBAC permission list
  to anyone holding a valid token for it. `apiError` (`lib/api/auth.ts`)
  grew an optional third `code` argument so a client can branch on a
  stable identifier instead of parsing English error text, used here
  and available to any future route that needs the same thing.
  `keke-mobile`'s `ApiError` class (`src/lib/api.ts`) now carries that
  same optional `code` field, populated from the response body.
  `AuthProvider`'s `loadProfile` (`src/context/auth-context.tsx`) is the
  single place all three ways a staff session could exist on a device
  get caught: a stale prior session found on app boot, a fresh password
  sign-in, and a fresh magic-link sign-in all funnel through this one
  function, so one check covers all three. On catching
  `STAFF_PORTAL_NOT_SUPPORTED` it clears the profile, sets a new
  `blockedMessage` state ("Staff and admin accounts sign in at the
  Ultimate web app, not here."), and force-signs the device out via
  `supabase.auth.signOut()`, so the app can never sit in a signed-in
  state for an account type it doesn't support. `sign-in.tsx` surfaces
  `blockedMessage` ahead of a plain form error (it means the password
  was actually correct, a more specific situation than "wrong
  credentials"), clears it the moment the person edits either field or
  tries again, and the audience tab that used to read "Staff · Agent ·
  Driver" now reads "Agent · Driver" since staff can no longer reach
  this app at all. Deliberately NOT built this round: a server-side
  block at the Supabase Auth level (a Supabase Auth Hook could refuse
  the sign-in itself before a client ever runs), which would be
  stronger defense-in-depth than this client-app-level reactive block,
  it needs Supabase project dashboard configuration this sandbox has no
  reach into, see the new Known gaps entry below. Also accepted on
  purpose: a brief UI "flash" is theoretically possible during a live
  staff sign-in attempt (`session` can go truthy for a moment before the
  async block check finishes and force-signs back out), judged harmless
  since every screen this app has gates its real content on `profile`,
  which never gets set to real staff data because `/api/v1/me` now
  throws before that.

**Module 42 follow-up fixes, round eight**: direct ask, "yes start the
driver," closing the last of the three portals that still showed
`keke-mobile`'s generic "your dashboard is on its way" placeholder.
Same deliberate pattern round six used for agent: a new `/api/v1`
route pair mirroring the existing web dashboard's own data functions,
then mobile types, a hook, and real screen content built on top.

- **New: `GET /api/v1/driver/summary`** (`app/api/v1/driver/summary/route.ts`)
  and **`GET /api/v1/driver/deposits`** (`app/api/v1/driver/deposits/route.ts`),
  closing the driver half of the "app/api/ gap" entry below. Identical
  shape to the investor and agent routes: `authenticateApiRequest`, 403
  if the account has no driver profile, otherwise
  `getDriverDashboardData`/`getDriverDeposits` (`lib/data/driver.ts`,
  the same functions `app/driver/dashboard/page.tsx` and
  `app/driver/deposits/page.tsx` already call) returned as JSON.
  `summary` returns `agentName`, `virtualAccount` (accountNumber/bankName
  or null if not yet issued), `currentVehicle` (assetTag, type, status,
  or null if unassigned, deliberately singular, a driver has exactly one
  vehicle, not a fleet the way agent's `assignedVehicles[]` is),
  `totalReceived`, a capped 5-entry `recentDeposits` preview, and an
  8-week `depositTrend`. `deposits` returns the uncapped list behind it,
  the same "no date-range params, a single driver's own deposit volume
  is naturally small" reasoning `GET /api/v1/agent/remittances` already
  used. No permission check beyond "does this account have a driver
  profile," same reasoning as the investor and agent routes: a driver
  can only ever see their own collection account, vehicle, and deposits.
- **New: the driver portal is real on `keke-mobile` now.** A new
  `useDriverSummary` hook (`src/hooks/use-driver-summary.ts`, the driver
  mirror of `useAgentSummary`, loading `fetchDriverSummary` and shared by
  all three tabs) backs real content for driver accounts specifically:
  Home (`DriverHome`, a new component in `(app)/index.tsx`, same reason
  `AgentHome` is its own component, needs nothing from `HomeScreen`'s own
  scope) shows the driver's Paystack collection account with the same
  3-step numbered explanation the web driver dashboard uses (anyone can
  pay into it, a confirmed deposit shows up automatically, it does not
  hand collections to the agent for you), the driver's single current
  vehicle (a new local `VEHICLE_STATUS_LABEL` map, mirroring the web
  dashboard's own, mobile had no equivalent before this), "Received, all
  time," the same 8-week trend chart every portal's Home uses (fed
  `depositTrend`), and a short recent-deposits preview linking to a new
  `driver-deposits.tsx` screen (`src/app/driver-deposits.tsx`, a Stack
  route registered in `_layout.tsx` alongside `agent-remittances`, the
  uncapped mirror of that screen adapted for deposits). Fleet's new
  driver branch shows the same single current-vehicle card rather than a
  list, since a driver has one vehicle, not a fleet, with a link into
  `driver-deposits.tsx`. Wallet's new driver branch mirrors the agent
  branch beside it: collection account, a "Received, all time" stat (no
  weekly target/paid-so-far pair, unlike agent, a driver's collection
  account is not measured against a weekly target), the deposit trend
  chart, and a "View full deposit history" button. Every portal that can
  sign into `keke-mobile` now has a real dashboard; see the Known gaps
  entries below, both updated to reflect this.

**Module 42 follow-up fixes, round nine**: direct hands-on testing of the
driver portal on a real phone (signing in with a real demo account,
watching the actual screen transitions rather than reading the code)
caught two real sign-in issues on `keke-mobile`, and surfaced a matching
bug on the web app that had been there since Module 24, plus a
Grammarly-caused console error on the same page. All three fixed.

- **`keke-mobile`: sign-in used to redirect into the app before it knew
  which portal the account belonged to.** The instant Supabase confirmed
  a password was correct, `sign-in.tsx` redirected into `(app)`, but
  `GET /api/v1/me` (the call that actually determines investor vs. agent
  vs. driver) was still in flight, decoupled from that redirect
  entirely. For a beat you'd land on `(app)/index.tsx` with `profile`
  still null, none of `isInvestor`/`isAgent`/`isDriver` true yet, which
  falls through to the generic "your dashboard is on its way" copy,
  before the real portal content swapped in a moment later.
  `src/context/auth-context.tsx`'s `onAuthStateChange` handler now wraps
  its `loadProfile()` call with `setLoading(true)`/`setLoading(false)`
  for a fresh sign-in too, not just the very first app launch (the only
  case the original `loading` flag covered), and both `sign-in.tsx`'s
  own redirect and the root gate screen (`app/index.tsx`) now wait on
  that flag before navigating into `(app)`, instead of `sign-in.tsx`
  redirecting on `session` alone.
- **Removed the "Investor" / "Staff, Agent, Driver" tabs on both apps'
  sign-in screens, they never actually gated anything and, on the web
  app, actively caused a bug.** Direct observation reported by the
  project owner: selecting the "Investor" tab on `keke-mobile` and
  signing in with driver credentials still correctly landed on the
  driver dashboard, because `GET /api/v1/me` never looked at which tab
  was selected, the tab was purely cosmetic on mobile, it had no effect
  on anything. Checking the web app's equivalent tab in response turned
  up a real, if soft, version of the exact Module 24 bug: the
  "Investor" tab (the default one on page load) just called
  `router.push("/investor/dashboard")` unconditionally, no check of the
  signed-in account's actual profile at all, unlike the "Staff / Agent /
  Driver" tab right next to it, which Module 24 already fixed to check
  properly. A staff, agent, or driver account signing in on the default
  tab got redirected to `/investor/dashboard`, which does guard against
  `!user.investor` and shows a friendly message rather than crashing,
  but still, a confusing detour for a correctly-typed password. Fixed by
  removing the tabs entirely on both apps: `keke-mobile`'s `sign-in.tsx`
  lost its `audience` state and the tab UI, nothing else changed, since
  the tabs were never wired to anything. `lib/actions/auth.ts`'s
  `resolveStaffPortalDestination` is now `resolvePortalDestination`,
  extended to also check `user.investor` (last, after staff, agent, and
  driver, the same priority order `GET /api/v1/me` already used), and
  `/sign-in`'s `completeSignIn` calls it unconditionally instead of
  branching on which tab was selected. One sign-in form now, on both
  apps, whatever credentials you type, the system finds the right
  dashboard, no tab left to get wrong.
- **A harmless but noisy console error reported from `/sign-in`:** "A
  tree hydrated but some attributes of the server rendered HTML didn't
  match the client properties," naming `data-new-gr-c-s-check-loaded`
  and `data-gr-ext-installed` on `<body>`. Both attribute names are
  Grammarly's browser extension writing onto the page before React
  hydrates, a cause React's own hydration-mismatch documentation names
  directly (browser extensions modifying the HTML), not anything this
  app's code or server response does, and it only appears for a visitor
  who actually has Grammarly (or a similar extension) installed.
  `app/layout.tsx` already carried `suppressHydrationWarning` on
  `<html>`, added at the Module 42 round four fix for the legitimate
  dark-mode-flash mismatch the theme-init script causes there, but per
  React's own docs that prop "only works one level deep," it never
  covered `<body>`. Added `suppressHydrationWarning` to `<body>` too,
  with a comment explaining the Grammarly cause so a future reader
  doesn't mistake it for silencing a real defect.

**Module 42 follow-up fixes, round ten**: direct ask, "the driver should
have his/her own profile settings, for changing his phone number, etc."

- **`/driver/settings`, `/agent/settings`, and `/admin/settings/security`
  only ever had the two-factor authentication card, missing the same
  "Phone number" and "Password" cards `/investor/settings` got in Module
  39.** All three pages already existed and were already linked from
  each portal's own nav (Module 24 gave driver and agent theirs), just
  underbuilt: `updateOwnPhone` and `PhoneSettingsForm`
  (`components/account/phone-settings-form.tsx`) were already built
  portal-agnostic from the start specifically so this would be a
  wiring job, not new work, per Module 40's own doc comment at the
  time ("the other three portals' security pages could add the
  identical card without touching the action itself"), and
  `/change-password` already works for any signed-in account too. Wired
  the identical two cards into all three pages, same copy as the
  investor page. Driver was the direct ask; agent and staff/admin had
  the exact same gap sitting right next to it, closed in the same
  round rather than waiting to be asked three separate times.
  (`/driver/settings` and `/agent/settings` were named `/driver/security`
  and `/agent/security` at the time, renamed in round eleven below.)
- **Bug found in the process: `updateOwnPhone` only ever called
  `revalidatePath("/investor/security")`, written back when that was
  the only page calling the action at all.** Once the other three
  security pages started calling it too, saving a new phone number on
  any of them would keep showing the old one until that page's own
  Next.js cache happened to expire on its own, since only the investor
  path was ever told to drop its cache. Now calls `revalidatePath` for
  all four portal security paths.

**Module 42 follow-up fixes, round eleven**: direct ask, "especially on
the web you should name the tab settings not security security should
inside settings."

- **Renamed `/investor/security`, `/agent/security`, and
  `/driver/security` to `/investor/settings`, `/agent/settings`, and
  `/driver/settings`, and their sidebar nav labels (`app/investor/layout.tsx`,
  `app/agent/layout.tsx`, `app/driver/layout.tsx`) from "Security" to
  "Settings" to match.** `/admin/settings` was already the reference
  shape for what "security should live inside settings" means: a
  "Settings" nav label linking to a hub page with "Security"
  (`/admin/settings/security`) as one tile among several, and needed no
  change at all. The other three portals only ever had one
  settings-related page each, not enough on their own to justify
  building a multi-section hub the way admin's is, so this is a plain
  rename rather than new structure. Each renamed page's own header text
  changed from "Security" to "Settings" too (`app/investor/settings/page.tsx`,
  `app/agent/settings/page.tsx`, `app/driver/settings/page.tsx`, functions
  renamed `InvestorSettingsPage`/`AgentSettingsPage`/`DriverSettingsPage`
  to match), since the two-factor authentication card is now clearly one
  part of the page rather than the page's whole identity, exactly what
  each page had already become the moment the Phone number and Password
  cards landed on it in round ten, just not renamed to say so yet.
  `updateOwnPhone`'s four `revalidatePath` calls (`lib/actions/auth.ts`)
  were updated to the new paths, `/admin/settings/security` unchanged.

**Module 42 follow-up fixes, round twelve**: direct ask, after
keke-mobile's own Profile tab was rebuilt around GTBank's grouped
settings-list layout (see keke-mobile's README for the frame-by-frame
review of that app this was modeled on): "you should do something
similar to the web app, make it as beutiful as the mobile too, group
them accordinly when one click on profile like that."

- **Two new shared components carry the whole redesign**:
  `SettingsGroup`/`SettingsRow`/`SettingsSectionLabel`
  (`components/design-system/settings-list.tsx`, a rounded card of
  `divide-y` rows, an icon, a bold primary line, an optional muted
  second line, and either a chevron or a custom trailing node) and
  `ToggleSwitch` (`components/ui/toggle-switch.tsx`, a `<button
  role="switch">`), plus five new line icons matching every sidebar's
  own icon language (`components/design-system/settings-icons.tsx`,
  translated one-for-one from keke-mobile's four new icons plus a new
  ProfileFieldIcon).
- **All four portal settings pages rebuilt** (`app/investor/settings/page.tsx`,
  `app/agent/settings/page.tsx`, `app/driver/settings/page.tsx`,
  `app/admin/settings/security/page.tsx`): three separate bordered
  `Card`s became two `SettingsGroup`s, "Personal data" (Full name,
  Phone number, Email, the first and last brand new, none of these
  pages showed a name or email before this round) and "Security"
  (Password, Two-factor authentication).
- **`MfaSettings` (`components/account/mfa-settings.tsx`) and
  `PhoneSettingsForm` (`components/account/phone-settings-form.tsx`,
  now wrapped by a new `PhoneNumberRow`) rebuilt as rows that expand
  in place** rather than always showing their form/panel, see "Account
  security" above for the full write-up of each.
- **`AppShell`'s sidebar avatar and name are now a link**
  (`components/layout/app-shell.tsx`'s new `profileHref` prop, one per
  portal layout) to the signed-in account's own settings page: "when
  one click on profile" now goes somewhere, matching keke-mobile's
  Profile tab. Previously that block was static.

## Server Actions and form safety (Module 43)

A Server Action that does `throw new Error(...)` for a real validation or
business-logic failure, bound directly to a plain `<form action={fn}>`
with no client-side try/catch, crashes to Next's generic error boundary
instead of showing the person a friendly inline message. This had been
found and fixed reactively six times across Modules 25-27 (see the
Known gaps bullet above this section), each fix its own small bespoke
Client Component wrapper. This module is the dedicated, systematic sweep
those entries kept flagging as still needed.

A general-purpose agent was dispatched first to find every `throw new
Error` across every `lib/actions/*.ts` file, trace every call site, and
classify each as UNSAFE (a real, user-reachable throw bound to a plain
form action, with no surrounding try/catch) or SAFE (already called from
a Client Component that catches it, or a throw that can only be reached
by tampering with a request, not through normal use of the app). It
found 32 unsafe functions across 13 files, plus one instance
(`retryDriverCollectionAccount` in `lib/actions/drivers.ts`) that had
silently never received the Module 25 fix its siblings
(`retryAgentCollectionAccount`, `retryInvestorCollectionAccount`) got,
still throwing on a Paystack failure instead of redirecting back with the
real message in the query string. That one was fixed to match its
siblings exactly, and `/admin/drivers` gained the same
`collectionAccountError` banner infrastructure `/admin/settings/staff`
and `/admin/investors/[id]` already had.

Rather than hand-write 32 bespoke wrapper components, a single reusable
`components/ui/action-form.tsx` was built instead: `<ActionForm action={fn}>`
takes over the plain `<form action={fn}>` binding with an `onSubmit`
handler that calls the action directly, catches a returned
`{ error?: string }`, and renders it inline. Its children originally
could be a plain node or a render-prop function
`({ isSubmitting, error }) => ...`, so a caller that needs to drive a
submit button's loading state (in place of `useFormStatus()`'s
`SubmitButton`, which only works with a native `action={fn}` binding)
got `isSubmitting` without its own local state. **That render-prop
shape turned out to be a real, crashing bug** the first time this ran
in an actual browser, see "ActionForm crash fix (Module 47)" below for
what broke and how it was fixed; every call site described in this
section has since moved off the render-prop onto that module's
`ActionSubmitButton`, this paragraph is kept for the historical
reasoning behind `ActionForm` itself, which is otherwise unchanged.
Crucially, `ActionForm` never wraps the action call in a try/catch itself:
`redirect()` and `revalidatePath()` inside a Server Action work
identically whether the action is bound natively or called directly as a
plain async function (the existing `NewBatchForm` component,
`app/admin/payments/batches/new/new-batch-form.tsx`, already proved this
before this module), and `redirect()` throws a special Next.js digest
error that a surrounding catch would incorrectly swallow.

Every real, user-reachable throw in the 32 flagged functions (across
`lib/actions/wallet.ts`, `transfers.ts`, `investor-profile.ts`, `rbac.ts`,
`documents.ts`, `contracts.ts`, `drivers.ts`, `staff.ts`, `fleet.ts`,
`investors.ts`, `payments.ts`, `settings.ts`, and `kyc.ts`) was converted
to a `{ error?: string }` return, and roughly 20 pages moved their
`<form action={fn}>` + `SubmitButton` call sites to `<ActionForm>` +
`Button loading={isSubmitting}`. What stayed a real `throw`, matching
this codebase's own established precedent (`retryAgentCollectionAccount`'s
own Module 25 comment): `if (!user) throw new Error(...)`, role-check
throws (`!user.investor`, `!user.staff`), and `ForbiddenError`/
`requirePermission()` throws. The real, permission-gated UI never lets an
unauthorized or wrong-role account reach these forms at all, so hitting
one of those paths needs a bypassed or tampered request, not normal use,
the same reasoning that already justified leaving them alone in every
prior instance of this fix.

One function's per-item throw was deliberately left alone rather than
converted: `approvePaymentBatch`'s inner "no bank account on file" throw,
inside its per-item Paystack loop, is already caught by that loop's own
surrounding try/catch and turned into a per-item FAILED status, it never
reaches the action's caller and converting it would have been a no-op.
Only the function's own top-level "already decided" status-guard throw
needed converting.

`npx vitest run` stayed at 80/80 through this module, `npx eslint` and
the em-dash sweep were run clean over every touched file, and
`npx tsc --noEmit` was checked against the same stale-Prisma-Client
noise baseline described in "Prisma CLI" under Known gaps below, none of
the errors it reports trace back to this module's own edits.

## Investor Settings hub (Module 44)

Direct feedback: "in the web the payout details is should be inside the
settings, documents should also be inside the settings, change password
should also be inside the settings, so when a user click on the profile
or investor's name it should open the settings."

Two of the three were already true. Clicking the sidebar avatar or
investor name already opened `/investor/settings`, `profileHref` on
`AppShell` has pointed there since round twelve. "Password" already
lived inside Settings too, as a `SettingsRow` linking out to
`/change-password`, not its own sidebar item, going back to the same
round.

What was missing: "Payout details" and "Documents" were each their own
top-level sidebar item on the investor portal (`app/investor/layout.tsx`),
sitting alongside Settings rather than inside it. Both moved into
`/investor/settings` as two new `SettingsRow`s under a new "Payments"
section (`app/investor/settings/page.tsx`), the exact same
navigate-away-chevron shape "Password" already used, `href` pointing at
their unchanged real routes (`/investor/payout-details`,
`/investor/documents`). Their old sidebar entries were removed, taking
the investor sidebar from seven items down to five: Dashboard, My
Investments, Payments, Wallet, Settings.

Neither page's content moved or was rebuilt inline on the Settings page
itself, only where they're reached from changed. A bank account form
that resolves against Paystack before saving, and a document uploader
with its own file input, size/type validation, and per-document status
badges, both already exist as real, working pages; embedding either
directly into Settings would have meant either duplicating that logic or
awkwardly nesting one page inside another, for no real benefit over a
row that navigates to it, the same reasoning "Password" already settled
for `/change-password`. Both routes stay reachable from their other
existing entry points too: `/investor/wallet`'s "Add bank details" link
and `/kyc`'s "Payout details" link both still work unchanged.

Two new field icons landed alongside this, `BankFieldIcon` and
`DocumentFieldIcon` (`components/design-system/settings-icons.tsx`),
reusing the exact shapes the removed sidebar items used, just resized to
this file's 18x18/1.6-stroke convention to match the rest of the
`*FieldIcon` set.

This module was scoped to the investor portal only, matching the direct
feedback's own wording ("investor's name"). The agent and driver
portals' settings pages (`app/agent/settings/page.tsx`,
`app/driver/settings/page.tsx`) do not have an equivalent "Documents" or
"Payout details" item to move, they were left untouched.

**Module 44 follow-up**, direct feedback: "i think it should be scoop to
all the web app." Audited `app/agent/layout.tsx`, `app/driver/layout.tsx`,
`app/admin/layout.tsx`, and the `/admin/settings` hub
(`app/admin/settings/page.tsx`) against the same three requests this
module started from:

- **Profile/name click already opens Settings on every portal.**
  `profileHref` on `AppShell` has pointed at each portal's own settings
  page since round twelve: `/agent/settings`, `/driver/settings`,
  `/admin/settings` (a hub, not a page directly, see
  `app/admin/layout.tsx`'s own comment on why), same as
  `/investor/settings`. Nothing to change.
- **"Password" already lives inside Settings on every portal**, never
  its own sidebar item anywhere, same `SettingsRow` pattern linking out
  to `/change-password` on all four (`/admin/settings/security` is the
  staff/Admin equivalent, one tile inside the `/admin/settings` hub
  rather than the whole page, see that page's own comment). Nothing to
  change.
- **"Documents" and "Payout details" living outside Settings was an
  investor-only problem to begin with.** A KYC document and a payout
  bank account are personal-account concepts that only exist for
  investors, an agent, driver, or staff/Admin account has nothing
  equivalent. Their sidebars confirm it: Agent is Dashboard, My
  Vehicles, Remittances, Settings; Driver is Dashboard, My Deposits,
  Settings; Admin's `/admin/settings` was already a hub of tiles
  (Security, Roles & permissions, Staff & agents, Contract defaults),
  never mixing a personal item alongside org-wide ones the way the
  investor sidebar used to mix "Documents" alongside "Settings". None of
  the three had a nav item to move, so none needed a code change.

No files changed for this follow-up, it is the audit trail confirming
the three portals already matched what Module 44 just built for
investors.

**Module 44 follow-up, round two**, direct feedback: "i have seen the
cards but is just by the left hand side only, it doesnt look good, make
it look good." Every one of the four portal settings pages
(`app/investor/settings/page.tsx`, `app/agent/settings/page.tsx`,
`app/driver/settings/page.tsx`, `app/admin/settings/security/page.tsx`)
shared the same layout bug: the `SettingsGroup` cards sat inside a
plain `max-w-[560px] px-8 py-6` `<div>`, a fixed narrow column with no
centering, pinned to the left edge. On any screen wider than 560px plus
the sidebar and padding, which is most desktop screens, that left a
large dead gap of empty page background on the right. It had always
been there, but only became noticeable enough to report once the
investor page grew a third `SettingsGroup` (Payments) in the earlier
Module 44 follow-up above, making the imbalance more obvious.

Fixed with a responsive two-column grid, `grid grid-cols-1 gap-x-6
px-8 py-6 lg:grid-cols-2 lg:items-start`, the exact same breakpoint and
class shape `/admin/settings/contract-terms` already uses for laying
out more content than comfortably fits one column
(`app/admin/settings/contract-terms/page.tsx`). Below the `lg`
breakpoint every settings page still renders as a single stacked
column, unchanged from before, so nothing regresses on the narrower
viewports this app already treats as their own layout. At `lg` and up:
the investor page puts "Personal data" in the left column and
"Payments" plus "Security" stacked in the right column; the other three
portals, which only ever had two groups, put "Personal data" and
"Security" side by side, one per column. Each column lands close to the
original 560px card width, so no individual row gets any harder to
read, this is purely about the page using the width it has instead of
stranding most of it as empty space. No change to `SettingsGroup` or
`SettingsRow` themselves (`components/design-system/settings-list.tsx`),
this was a page-level layout fix only, not a component-level one.

## Hardening pass (Module 45)

Direct feedback: "okay fix everything but we will talk about deploying
the mobile to app/play store, the bvn/nin and the car and bike contract
terms too leave it for now," in response to a "so what is remaining?"
status check that had grouped the open items into three buckets: needs
something outside this sandbox, needs a decision or real numbers from
the user, and worth doing but low-risk. This module worked through the
first bucket in full and left the second bucket (BVN/NIN, CAR/BIKE
contract terms) and app-store deployment untouched, on the user's own
words, see the README Module 45 entry for the summary version of
everything below.

**npm audit, keke-platform: 3 high to 0.** All three findings
(`@prisma/config`, `deepmerge-ts`, `prisma`) trace to one real
vulnerability, GHSA-ggr8-5vv4-36mx, a stack-exhaustion bug in
`deepmerge-ts@7.1.5`, a dependency of Prisma's own config loader
(`prisma.config.ts`/`package.json#prisma` merging), never bundled into
the deployed Next.js server. `npm audit`'s suggested fix was
`prisma@6.12.0`, an actual downgrade from the `6.19.3` installed, not a
real fix; checked further and found the latest stable Prisma (7.10.0 at
the time of checking) still depends on the same vulnerable
`deepmerge-ts` version, so there is no fix currently available through
a Prisma version bump at all, in either direction. Fixed with a
targeted override in `package.json`:
```json
"overrides": { "deepmerge-ts": "^8.0.2" }
```
Checked before applying: `deepmerge-ts@8.0.2`'s `package.json` against
`7.1.5`'s, identical `type`/`main`/`exports` shape, a safe override
target, not a guess. After `npm install`, `npm audit` reports 0
vulnerabilities. Verified `npx vitest run` (80/80), `npx eslint .`
(clean), and exercised the Prisma CLI directly, `npx prisma --version`
and `npx prisma validate`, both of which load config through
`deepmerge-ts` internally, both reached the exact same
`binaries.prisma.sh` network-blocked failure this sandbox already had
before the override (not a new or different failure), strong evidence
the override changed nothing about how the CLI actually runs.

**npm audit, keke-mobile: 14 moderate to 3.** Two separate leaf
packages accounted for all 14: `uuid@7.0.3` (`expo-splash-screen` ->
`@expo/config-plugins` -> `xcode` -> `uuid`) and
`decode-uri-component@0.2.2` (`expo-router` -> `query-string` ->
`decode-uri-component`). Checked `uuid`'s vulnerable range (`<11.1.1`,
a missing buffer bounds check) against what's actually available:
`uuid@11.1.1`'s `package.json` has a dual CJS/ESM export map, and a
scratch-project smoke test (`require('uuid').v4()`) confirmed it works
under plain `require()`, the same way `xcode`'s own source
(`pbxProject.js`) calls it. Applied:
```json
"overrides": { "uuid": "^11.1.1" }
```
`npm install` succeeded, and the finding count dropped from 14 to 3,
far more than the one package being fixed: npm audit had been flagging
every package upstream of `uuid` in that chain (`@expo/config-plugins`,
`expo-splash-screen`, and others) as "vulnerable" too, since they
transitively depend on it, not because each was independently broken.
Fixing the one leaf resolved the entire cascade. Verified
`npx tsc --noEmit` and `npx eslint .`, both clean.

The remaining 3 (`decode-uri-component`, `query-string`, `expo-router`)
are disclosed, not fixed. `decode-uri-component`'s only non-vulnerable
release is `0.5.0` (the range in between, `0.4.2` to `0.4.3`, simply
doesn't exist as a published version), and `0.5.0` dropped CommonJS
support entirely: its `package.json` has `"type": "module"` and an
`exports` map with no `require` entry at all, confirmed directly, a
scratch install of `0.5.0` throws `TypeError: decode is not a function`
under `require('decode-uri-component')`. `query-string@7.1.3` (pinned
by `expo-router@57.0.18`) requires it with plain `require()`
(`node_modules/query-string/*.js`), confirmed by grep. Overriding to
`0.5.0` would be a real breaking change, a pure-ESM package being
`require()`'d from CommonJS code, unverifiable without an actual Metro
bundle running on a device, which this sandbox cannot do. Left alone
rather than forced blind, this is a correctly-identified risk, not an
oversight.

**keke-mobile: the Supabase session is now encrypted at rest.** New
file `src/lib/secure-session-storage.ts` implements Supabase's own
documented "LargeSecureStore" pattern for React Native. Two new runtime
dependencies (neither previously installed): `aes-js` (the AES cipher
itself, CTR mode) and `react-native-get-random-values` (a
`crypto.getRandomValues` polyfill, since React Native has no native
Web Crypto implementation), plus `expo-secure-store` (Expo's
keychain/Keystore-backed small-value store) and `@types/aes-js` for
TypeScript. On every write, a fresh random 256-bit AES key is
generated, the actual value is encrypted with it, the key (not the
value) goes into `expo-secure-store`, and the ciphertext goes through
the existing `FileSystemStorage` (`src/lib/file-storage.ts`, this
project's `expo-file-system`-backed AsyncStorage replacement, see that
file's own comment for why AsyncStorage itself isn't usable under Expo
SDK 57's bridgeless runtime in Expo Go). `file-storage.ts` never sees
anything but ciphertext now. `src/lib/supabase.ts`'s `auth.storage` now
points at `SecureSessionStorage` instead of `FileSystemStorage`
directly, its comment rewritten to describe the layered approach rather
than the old single-store one. A fresh key per write, rather than one
long-lived key, matches Supabase's own reference implementation: one
extra `SecureStore` write per sign-in/refresh (infrequent) in exchange
for never reusing a key across writes. Verified `npx tsc --noEmit` and
`npx eslint .`, both clean; **not** verified on a real device, this
sandbox has no phone or simulator attached to `keke-mobile`. The
concrete check worth doing on a real device: sign in, force-quit the
app, relaunch, confirm the session is still there and nothing regressed
around sign-out clearing both the ciphertext and the key.

**Admin-initiated password resets: researched, already covered, no
code change.** The open question since Module 30/round seven was
whether `resetInvestorPassword`, `resetStaffOrAgentPassword`, and
`resetDriverPassword` (`lib/actions/investors.ts`, `staff.ts`,
`drivers.ts`), which all call
`supabaseAdmin.auth.admin.updateUserById(authId, { password })`, force
that account's other sessions to sign out the way the self-service
`/reset-password` flow explicitly does with
`signOut({ scope: "others" })` (round seven). Round seven left this
open specifically because it "could not get authoritative confirmation
of what, if anything, GoTrue does to existing sessions on an
admin-initiated password change." This round got that confirmation:
current Supabase Auth (GoTrue) server behavior, checked against a still
open supabase/auth GitHub issue (#1579, "Updating a user's password
kills their session"), is that `updateUserById` with a new password
now immediately kills that user's existing session, a change from
older GoTrue versions (the issue places it somewhere after v2.149) that
is not documented as an official guarantee but is real and current on
hosted Supabase projects, which auto-update to the latest server
version. Every deployment of this app runs on a hosted Supabase
project, so all three admin-reset paths already get this behavior for
free, there is nothing in this app's own code to change. Marked
resolved below, with the caveat that it rides on Supabase's own server
behavior rather than a contract this app enforces itself, worth a real
check on the user's own project (reset a password from the admin panel
while signed in as that user on a second device or browser, confirm
that second session gets kicked immediately).

**A real Content-Security-Policy, nonce-based.** `next.config.ts`'s
`headers()` still sets the five response headers round seven added
(`X-Frame-Options` and friends), unchanged, but CSP itself now lives in
`proxy.ts`, not there, since it needs a fresh, unpredictable nonce on
every single request, something a static `headers()` entry has no way
to generate. Follows the pattern Next.js's own App Router docs
recommend: `proxy.ts` generates the nonce with
`Buffer.from(crypto.randomUUID()).toString("base64")`, sets it on both
the `Content-Security-Policy` response header and an `x-nonce` request
header; `app/layout.tsx` reads `x-nonce` back with `next/headers` and
passes it explicitly to the theme-init `<Script>`'s `nonce` prop
(Next.js automatically nonces its own framework and page scripts by
parsing the CSP header itself, this one hand-written inline script is
the documented exception that still needs it passed explicitly).

Every directive was checked against what this app actually loads,
grepped directly, not copied from a generic template:
- `script-src 'self' 'nonce-<value>' 'strict-dynamic'` (plus
  `'unsafe-eval'` in development only, React's dev-mode error
  reconstruction needs it, Next's own docs call this out, production
  never needs it).
- `style-src 'self' 'unsafe-inline'`. Nonces do not apply to inline
  `style=""` attributes at all, per the CSP spec itself, only to
  `<style>` elements, and this app has real dynamic inline styles
  (progress bar widths in `components/ui/progress.tsx`, per-row status
  dot colors across the fleet/dashboard views, `app/global-error.tsx`'s
  own inline styles, which render completely outside this layout and
  any nonce it could supply since it's Next's required top-level error
  boundary). Style injection is a materially smaller risk than script
  injection; this is the documented, accepted tradeoff, not an
  oversight.
- `img-src 'self' blob: data:'`. `data:` for the MFA enrollment QR code
  (a `data:` URI straight from Supabase's own TOTP API,
  `components/account/mfa-settings.tsx`), `blob:` for anything
  client-generated.
- `connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL, or a *.supabase.co
  fallback if that env var isn't set> https://*.sentry.io
  https://*.ingest.sentry.io`. The Supabase project URL is needed
  because `lib/supabase/client.ts` is a real browser-side Supabase
  client, sign-in, sign-up, and MFA all call it directly from the
  browser, not just from the server. Sentry's browser SDK
  (`instrumentation-client.ts`) reports errors straight from the
  browser to whichever ingest subdomain the project's DSN resolves to,
  which isn't fixed in advance, hence the wildcard. Paystack needed
  nothing added anywhere: every Paystack call in this app
  (`lib/payments/paystack-client.ts` and everything that calls it) is
  server-side only, the browser never talks to Paystack directly.
- `frame-ancestors 'none'`, the CSP-native, modern-browser version of
  the `X-Frame-Options: DENY` header `next.config.ts` already sets,
  kept alongside it (not instead of it) for older browsers that only
  honor `X-Frame-Options`.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `upgrade-insecure-requests`: the standard, low-risk baseline the
  Next.js docs' own template includes.

Nonce-based CSP requires every page it applies to be dynamically
rendered, since a fresh nonce every request means nothing can be
statically cached. Checked whether that's actually true here before
relying on it: 61 of this app's 67 `page.tsx` files already call
`getCurrentUser()`, which reads cookies and already forces dynamic
rendering per request; the remaining 6
(`sign-in`, `sign-up`, `admin-sign-in`, `forgot-password`,
`reset-password`, `setup`, the public/auth pages) plus the root
`app/page.tsx` redirect did not, and the new `headers()` read this
module adds to the root layout, which wraps every route, forces those
dynamic too, automatically, with no per-page `force-dynamic` export
needed anywhere.

Not verified against a real running browser, this sandbox has no live
one attached to this app. Every directive above is backed by a direct
grep of what this codebase actually loads rather than guessed, but the
user should watch the browser console for CSP violation reports after
this ships, especially around sign-in/sign-up/MFA (the paths that talk
to Supabase straight from the browser) and the QR code enrollment step.

**The font is now self-hosted, `next build` gets meaningfully
further.** `next build` has never completed in this sandbox. Confirmed
directly why with `curl`: `fonts.googleapis.com` and
`fonts.gstatic.com` both refuse the CONNECT tunnel with a 403, an
egress policy for this sandbox specifically, not anything wrong with
the app, and `next/font/google`'s `Plus_Jakarta_Sans` needs to reach
those at build time to download the font files, even though it serves
them from this app's own origin at runtime, never from Google, either
way. Swapped it for `next/font/local`, pointing at the same font's
actual `.woff2` files for all five weights this app uses
(400/500/600/700/800, latin, normal), sourced from the
`@fontsource/plus-jakarta-sans` npm package (same upstream font, same
SIL Open Font License, reachable through the ordinary npm registry
rather than Google's CDN) and checked into
`app/fonts/plus-jakarta-sans/` alongside its license file. Output is
identical either way: same `--font-plus-jakarta-sans` CSS variable, no
other file in the app needed to change.

This did fix the font block specifically: a real `npm run build` now
gets past font loading entirely and into Next's own type-checking step,
further than it has ever reached in this sandbox before. It still
cannot finish here, though, blocked by a separate, already-documented
limitation: `npx prisma generate` also cannot reach
`binaries.prisma.sh` from this sandbox (confirmed again this round,
including trying the documented offline escape hatch,
`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`, which gets one step further
before hitting the same 403 on the actual engine binary download), so
the Prisma Client checked into `node_modules/.prisma` here stays stale,
and the type-check step during `next build` fails on that staleness
(implicit-any callback parameters, "has no exported member" errors,
the exact same errors `npx tsc --noEmit` already showed). Cross-checked
file-for-file against the baseline this document already tracked before
this module: every failing file is one already on that list, nothing in
this module's own changed files appears in the failure output. On the
project owner's own machine, where `binaries.prisma.sh` is reachable,
running `npx prisma generate` (already a documented required setup
step, see "How to get this running" above) and then `npm run build`
should now complete cleanly, since the one blocker this sandbox could
never work around either way is gone.

## BVN/NIN verification (Module 46)

Second of the three items explicitly deferred at the end of Module 45
("okay fix everything but we will talk about deploying the mobile to
app/play store, the bvn/nin and the car and bike contract terms too
leave it for now"). The CAR/BIKE contract term item was closed with no
code change, entering real figures through
`/admin/settings/contract-terms` once the business has them, rather
than hardcoding placeholders, was confirmed as the right shape already
in place. App/Play Store deployment is still untouched. This section
covers the BVN/NIN item.

**Vendor research, before writing any code.** Paystack (already
integrated, see "Payments" above) cannot check a NIN at all, and its
BVN check is not a standalone lookup: "Validate Customer" validates a
BVN together with a specific bank account and name, is asynchronous
(returns "in progress," resolved later by a
`customeridentification.success`/`.failed` webhook), requires a
Paystack customer record first, and by Paystack's own docs only
applies to accounts in the "Betting, Financial services, or General
Services" category, unconfirmed whether this business's Paystack
account is even in one of those. So this needed a separate vendor.
Compared three on what's actually publicly documented: Dojah,
Youverify, and VerifyMe Nigeria (now routed through a product called
QoreID). Picked Dojah, the only one of the three with concretely
documented, synchronous endpoints for both BVN (`GET
/api/v1/kyc/bvn/full`) and NIN (`GET /api/v1/kyc/nin`), a free sandbox
to test against, and transparent starting pricing ($0.04 to $0.06 per
call, no "contact sales" wall). Two caveats stayed true after the
research and are still true now: no independent user reviews were
found for Dojah (a young company, an unclaimed review-site listing),
and none of the three vendors checked publicly claim official
NIMC/NIBSS partner status anywhere in their own marketing or docs,
worth confirming directly with Dojah before this goes live with real
credentials, not something this research settled on its own.

**Regulatory scope, discussed but deliberately not resolved here.**
Whether not having automated BVN/NIN verification (before this module)
or not being NIMC/NIBSS-partnered (still true after this module, per
the caveat above) creates real regulatory exposure was raised directly
by the user as a question. Two separate threads came out of that
discussion, worth keeping distinct: the CBN's three-tier KYC framework
and Paystack's own category-dependent BVN validation requirement are
concrete enough to research from public documentation (see above and
"Payments"), but whether the SEC's crowdfunding-intermediary
registration rules apply to this business is a genuinely open legal
question this research could not resolve either way, since the public
SEC material describes a multi-issuer portal model and it's unclear
from the outside whether a single company selling its own investment
contracts directly falls under the same rules. Flagged to the user as
something that needs real legal counsel, not something this module (or
any future one) should be treated as having settled by implementing a
verification check.

**What was actually built.** `lib/verification/dojah-client.ts` is the
same "one file owns every real call to this vendor" shape
`lib/payments/paystack-client.ts` already established for Paystack:
`getBaseUrl()` (sandbox `https://sandbox.dojah.io` by default, live
`https://api.dojah.io` only once `DOJAH_ENVIRONMENT=live` is set),
`isDojahConfigured()` (true only once both `DOJAH_APP_ID` and
`DOJAH_API_KEY` are set), `lookupBvn()`/`lookupNin()` (GET requests
with `AppId` and `Authorization` headers, the latter carrying the raw
key with no `Bearer` prefix, Dojah's own documented header shape,
different from Paystack's `Bearer ${key}`), and
`namesReasonablyMatch()`, a deliberately lenient check (first and last
name must both appear somewhere in the investor's own typed full name,
either order, middle name ignored entirely) rather than an exact
string match, since real self-entered names routinely drop or reorder
a middle name and a stricter check would flag legitimate investors as
mismatches. `lib/verification/identity-check.ts` wraps both lookups
into the four-value result the schema stores
(`VERIFIED`/`NAME_MISMATCH`/`NOT_FOUND`/`FAILED`), and returns `null`,
not `FAILED`, when Dojah isn't configured, a distinct "this feature is
off" state from "we tried and it failed," the same distinction
`PAYSTACK_SECRET_KEY` being unset already gets elsewhere in this app.

`InvestorProfile` gets six new nullable columns
(`prisma/migrations/20260907140000_add_bvn_nin_verification`), three
per identifier: `bvnVerificationStatus`/`ninVerificationStatus` (the
new `VerificationStatus` enum), `bvnVerifiedName`/`ninVerifiedName`
(the name Dojah returned), and `bvnVerifiedAt`/`ninVerifiedAt`. The
existing `bvn`/`nin` text columns are untouched, still exactly what the
investor typed, independent of whether it was ever checked.

`/kyc`'s existing form (`app/kyc/actions.ts`,
`submitIdentityDetails`) now calls Dojah the moment a BVN or NIN
actually changes from what's already saved, not on every
re-submission, so re-typing one field doesn't spend a second call on
a number nothing new is known about. The form
(`app/kyc/identity-form.tsx`) shows a badge next to each field once
there's a result: green "Verified," red "Name doesn't match" or "Not
found," amber "Could not check." Staff sees the same signal, plus the
name Dojah has on file, on `/admin/kyc/[investorId]`
(`lib/data/kyc.ts`'s `getInvestorKycDetail` now returns the four new
display fields alongside the existing ones).

**This is a signal, not a gate, on purpose.** Nothing here blocks
saving `/kyc`, and `kycStatus` still only ever moves to
`PENDING_REVIEW` from this form, never straight to `VERIFIED`, exactly
the same rule that already existed before this module. An automated
name mismatch is a strong, real reason for staff to look closer at a
submission through the existing manual document review at
`/admin/kyc`, not grounds to auto-reject an investor over what could
just as easily be a Dojah data-quality issue. Full automated
KYC decisioning was never in scope here.

**Fully backward compatible with `DOJAH_API_KEY`/`DOJAH_APP_ID`
unset**, the state every deployment starts in until the project owner
actually signs up with Dojah and confirms it. Unset, this behaves
exactly as it did before this module: BVN/NIN save as plain text,
`kycStatus` still moves to `PENDING_REVIEW`, no verification fields
ever get touched, no Dojah call is ever attempted. `.env.example`
documents `DOJAH_APP_ID`, `DOJAH_API_KEY`, and `DOJAH_ENVIRONMENT`
(defaults to sandbox, matching the safe-by-default posture
`PAYSTACK_DVA_PREFERRED_BANK=test-bank` already uses elsewhere).

**Verification results.** `npx vitest run`: 98/98 across the whole
suite, 18 new (`lib/verification/dojah-client.test.ts`), covering
`isDojahConfigured`, both lookup functions (URL/header correctness,
sandbox vs live host selection, success, 404, missing-entity,
non-404 error status, and a rejected `fetch` promise), and all seven
`namesReasonablyMatch` cases. `npx eslint .` on every touched file:
clean. `npx tsc --noEmit`, filtered against the touched-files list:
zero new errors, everything remaining cross-checked against this
document's already-known baseline noise. **Not** verified against a
live Dojah account: this sandbox has neither real Dojah credentials
nor, per Module 45's own findings, reliable outbound network access to
exercise one even with real credentials. The request shape, header
names, and response field names come straight from Dojah's own current
published API reference (fetched and read directly this module, not
recalled from memory), not guessed, but a real sandbox-key smoke test
on the project owner's own machine is worth doing before this goes
anywhere near a live BVN or NIN.

## ActionForm crash fix (Module 47)

Direct feedback: clicking into `/investor/wallet` crashed with a real
runtime error, "Functions are not valid as a child of Client
Components. This may happen if you return children instead of
`<children />` from render." Next.js version 16.3.3 (Turbopack). This
sandbox has never had a real browser attached to this app (see the
first bullet under Known gaps below), so nothing here caught this on
its own, it took a real click in the project owner's own browser.

**Root cause.** `ActionForm` (`components/ui/action-form.tsx`, see
"Server Actions and form safety (Module 43)" above) originally let a
caller pass its submit button as a render-prop:
`children={({ isSubmitting }) => <Button loading={isSubmitting}>...</Button>}`.
The React Server Components rule this breaks is exact and easy to
miss: a Server Component (no `"use client"`) is allowed to pass a
Client Component plain, already-resolved JSX as `children`, since a
JSX element is just a serializable `{type, props}` description, but it
can never pass a function, functions cannot cross the server/client
boundary at all except when explicitly exposed as a Server Action.
Nearly every `<ActionForm>` call site in this codebase is written
directly inside a Server Component page, so nearly every one of them
was carrying this exact bug, silently, since Module 43 shipped it.
It only happened to work in the three places `<ActionForm>` was used
from inside a dedicated Client Component form file
(`app/kyc/identity-form.tsx`, `app/admin/contracts/new/new-contract-form.tsx`,
`app/admin/wallet/funding/[investorId]/fund-vehicle-form.tsx`),
because there both sides of that render-prop were already Client
Components, nothing actually crossed a server/client edge in those
three.

**Scope, found by grep, not guessed.** Searched every `.tsx` file in
the repo for the `<ActionForm action={...}>` + immediately-following
`{(` render-prop shape, then manually confirmed each match either had
or lacked a `"use client"` directive. 20 files carried the bug: 16
Server Component pages
(`app/investor/wallet/page.tsx`, `app/admin/wallet/bank-change-requests/page.tsx`,
`app/admin/wallet/withdrawals/page.tsx`, `app/admin/kyc/[investorId]/page.tsx`,
`app/admin/settings/contract-terms/page.tsx`, `app/admin/settings/staff/new/page.tsx`,
`app/admin/fleet/new/page.tsx`, `app/admin/fleet/[id]/page.tsx`,
`app/admin/drivers/new/page.tsx`, `app/admin/drivers/page.tsx`,
`app/admin/payments/batches/[id]/page.tsx`, `app/admin/investors/new/page.tsx`,
`app/admin/settings/roles/[id]/page.tsx`, `app/admin/settings/roles/new/page.tsx`,
`app/investor/payout-details/page.tsx`, `app/admin/transfers/[id]/page.tsx`),
one shared Server Component
(`components/documents/document-section.tsx`, the upload/delete card
used on both the admin contract detail page and the admin fleet detail
page, caught only by `tsc` after the first pass, its own grep pattern
had been scoped to `app/` and missed it), and the three Client
Component form files named above, which were not actually broken but
used the same soon-to-be-removed API and needed updating regardless.
Wallet was simply the first page the project owner happened to click
into, not the only one that would have crashed.

**Fix.** Converted `ActionForm` from a render-prop to a small React
Context: `ActionFormContext` carries `{ isSubmitting, error }`, and a
new `ActionSubmitButton` (same file, also `"use client"`) reads that
context and renders the actual `<Button type="submit" loading={...}>`.
`ActionForm`'s `children` type is now plain `ReactNode`, the function
overload was removed entirely, not just left as an unused option, so
the same mistake cannot be reintroduced by copy-pasting an old call
site. Every one of the 20 files converted from
`{({ isSubmitting }) => <Button loading={isSubmitting}>Label</Button>}`
to plain `<ActionSubmitButton>Label</ActionSubmitButton>`, mechanical
in every case: none of the 38 call sites in the codebase used `error`
from the render-prop (`ActionForm` already renders its own error
message inline, unchanged by this fix) or used `isSubmitting` for
anything besides that one `Button`'s `loading` prop, confirmed by grep
before starting, not assumed.

**Verified.** `npx eslint .` clean across the whole project (not just
touched files). `npx tsc --noEmit`: zero errors mentioning
`isSubmitting`, `ActionSubmitButton`, or `action-form.tsx` (the first
pass surfaced exactly the four `document-section.tsx` errors that
caught the file the initial grep missed, confirming this check is
doing real work, not rubber-stamping); the ~275 lines it still prints
are line-for-line the same pre-existing implicit-any /
stale-Prisma-Client noise this document's Known gaps section below
already tracks, cross-checked file by file against every file this
module touched. `npx vitest run` stayed at 98/98, unsurprising, this
bug shape (a runtime child-serialization violation) is not something a
unit test around a Server Action's return value would ever catch, only
an actual render does, which is exactly what none of the automated
checks in this sandbox can do. **Still not verified against a real
running browser**, that limitation is unchanged and is why this bug
existed for as long as it did in the first place, see the first
bullet under Known gaps; this fix removes the exact API shape that
violated a documented React/Next rule rather than papering over one
symptom, and every affected page now compiles and passes every check
this sandbox can run, but a real click-through of Wallet and the other
19 fixed pages in the project owner's own browser is worth doing
before considering this fully closed.

## Real `next build` type error, fixed (Module 48)

The project owner ran `npx prisma generate` for real on their own
machine (succeeded, confirming again this sandbox's block on
`binaries.prisma.sh` is a sandbox-only limit), then `npm run build`
(the correct command; a bare `next build` in PowerShell fails with
`CommandNotFoundException` since `next` is a project devDependency,
not a global command, not a bug, just the wrong invocation) and got
past `Compiled successfully` into one real type-check failure:

```
lib/data/investor.ts(99,19): error TS18047: 'c.vehicle.currentDriver.user' is possibly 'null'.
```

**Genuine bug, not this sandbox's usual stale-Prisma-Client noise.**
`getInvestorDashboardData`'s `vehicles.map()` read
`c.vehicle.currentDriver?.user.fullName`, one `?.` short. Checked
`prisma/schema.prisma` directly rather than assuming: `Driver.user` is
declared `User? @relation(...)`, "a driver may or may not have direct
app access," the only nullable `user` relation among
`InvestorProfile`/`Agent`/`StaffProfile`/`Driver`, the other three are
all a plain required `User`. The existing `?.` after `currentDriver`
only covers a vehicle having no assigned driver at all; a driver can
be assigned and still have no linked `User` row (pre-Module-22
drivers, or ones created directly against the database, see the "SMS
through `sendUntrackedSms()`" bullet under Known gaps below, the exact
same underlying nullability). Neither `npx tsc --noEmit` nor `next
dev` catch this here (both let a single `?.` through without
complaint on this expression), only a real, complete `next build`
type-checks strictly enough to catch a missing chain link two levels
deep like this, matching exactly the pattern "Module 31, a full pass"
under Known gaps already documented: this sandbox's own checks are
real but not sufficient on their own, an occasional real build from a
machine that can run one to completion catches a different class of
bug than lint or `tsc --noEmit` alone.

Fixed with the missing link:
`currentDriver?.user?.fullName ?? null`. Before calling it done,
grepped every `.user.fullName`/`.user.email`/`.user.phone` access in
the entire codebase (`lib/`, `app/`, dozens of call sites) rather than
assuming this was the only one: every other access reads `.user` off
`InvestorProfile`/`Agent`/`StaffProfile`, all non-nullable so no
second `?.` is ever needed there, or is on `driver.user` itself and
already correctly guarded with an explicit `if (driver.user)` check
first (`lib/actions/drivers.ts`'s `updateDriver`). This was a single,
isolated instance, not a repeated pattern. `getInvestorDashboardData`
backs both the web investor dashboard (`/investor/dashboard`) and,
unchanged since Module 37, the mobile
`GET /api/v1/investor/summary` endpoint, so the one fix covers the web
app and `keke-mobile` at once, nothing mobile-side needed touching.

Verified: `npx eslint .` clean, `npx tsc --noEmit` shows the exact
same pre-existing implicit-any/stale-Prisma-Client lines this document
already tracks, nothing new introduced by this one-line fix, `npx
vitest run` stayed at 98/98. **Not re-verified with a second `next
build`** from inside this sandbox, it still cannot run one to
completion here (see "This project has only ever been checked with
`npm run lint`" under Known gaps below); the project owner's own next
`npm run build` is what actually confirms this fix, the same
close-the-loop step that caught it in the first place.

## Migration deploy step owed, and a researched console warning (Module 49)

Three findings from the project owner's own machine, one round:

**Module 48's fix confirmed for real.** `npm run build` came back
fully clean: all 78 routes compiled, typechecked, and generated with
zero errors, `Finished TypeScript`, no output beyond the route list.
Module 48's own entry above shipped its fix without this confirmation
(this sandbox cannot run a `next build` to completion, see Known gaps
below), so this closes that loop rather than leaving it assumed.

**A real operational gap, not a code bug: the Module 46 migration was
never applied to the project owner's real database.** `npm run dev`
failed on every signed-in page (`/investor/wallet`, `/investor/dashboard`,
`/investor/settings`, `GET /api/v1/me`, all the same root cause) with
`PrismaClientKnownRequestError` `P2022`, `The column
investor_profiles.bvnVerificationStatus does not exist in the current
database`. `prisma/schema.prisma` and the regenerated Prisma Client
both already know about the six columns Module 46 added (that's why
`npx prisma generate` succeeded cleanly, see Module 48 above), but the
actual Postgres database behind the project owner's Supabase project
had never had
`prisma/migrations/20260907140000_add_bvn_nin_verification` applied to
it, a file landing in the project folder is not the same thing as a
migration being run. **The fix is a command, not a code change**:
`npx prisma migrate deploy` from the project owner's own machine,
which can reach the database (confirmed by `prisma generate` already
succeeding there) and applies whatever migrations in
`prisma/migrations/` the database's `_prisma_migrations` table doesn't
already record as applied, in order, leaving the four migrations
already confirmed applied back in Module 31 untouched.
Deliberately recommended `migrate deploy` over `migrate dev` here: the
`dev` variant can prompt to reset the database when it detects drift,
never the right move against a database already holding real investor
data, `deploy` only ever applies forward, non-interactively. This was
confirmed resolved shortly after, see "Migration deploy confirmed, and
a missing migration file recovered (Module 50)" below.

**Researched and deliberately left alone: a cosmetic console
warning.** Reported alongside the above: "Encountered a script tag
while rendering React component. Scripts inside React components are
never executed when rendering on the client," pointing at the
theme-init script in `app/layout.tsx` (Module 42). Investigated with
web research rather than guessed at: this is a known, currently
unresolved React 19 + Next.js 16.2+ false positive, confirmed against
multiple independent reports of the identical message hitting
`next-themes` (the most widely used React theming library, doing the
exact same "inline script that runs before hydration" pattern this
app's own theme-init script does,
https://github.com/pacocoursey/next-themes/issues/387 and `#385`) and
an open shadcn/ui documentation issue asking for guidance on it
(https://github.com/shadcn-ui/ui/issues/10104, which describes it as
"technically a false positive since the script executes correctly
during server-side rendering"). Checked whether this app's own
placement (`<Script>` inside a hand-written `<head>`) was the actual
cause before ruling that out too: Next's own docs state
`beforeInteractive` scripts "will always be injected inside the
`head`... regardless of where it's placed in the component," so moving
it would not have changed anything.

A real fix exists in theory: `useServerInsertedHTML` injects raw HTML
directly into the server's HTML stream, entirely outside anything
React's client-side renderer ever reconciles, which is exactly why it
would dodge this specific warning (used elsewhere in the Next.js
ecosystem for CSS-in-JS critical-style injection, the same underlying
mechanism). It was drafted, then deliberately not shipped: an open,
still-unresolved Next.js GitHub discussion
(https://github.com/vercel/next.js/discussions/43551) reports that
hook's inserted content landing somewhere other than `<head>`,
inconsistently, for other users, on other projects. For most content
that would just be untidy; for a script whose entire purpose is
running before paint, on every request, for every visitor, that is
exactly the wrong kind of uncertainty to accept without a real browser
in this sandbox to verify the change against, the same "never had a
real browser attached" limitation the Module 47 crash already proved
matters concretely, not theoretically. Given the choice between a
confirmed-cosmetic warning and a code change with a real,
unverifiable-here risk of reintroducing a visible flash-of-wrong-theme
regression, the warning was left in place. See `app/layout.tsx`'s own
comment for the same reasoning kept close to the code. Revisit if
Next.js or React ship an official resolution, or if the
`useServerInsertedHTML` change is verified safe in a real browser
first.

## Migration deploy confirmed, and a missing migration file recovered (Module 50)

Direct follow-up from the project owner's own machine: ran `npx prisma
migrate deploy` as instructed by Module 49 above and pasted the
result. It reported "7 migrations found in prisma/migrations," applied
`20260907140000_add_bvn_nin_verification` successfully, and confirmed
"All migrations have been successfully applied." That closes Module
49's operational gap: the signed-in pages that were failing with
`PrismaClientKnownRequestError` P2022 on `bvnVerificationStatus`
should load again.

**A second, real gap surfaced while confirming it, and was fixed.**
That "7 migrations found" was one more than expected: this sandbox's
own working copy of `prisma/migrations/` had only 6 folders on disk,
not 7. Listing the project owner's real folder through the device
bridge found the extra one:
`prisma/migrations/20260901140414_add_password_and_payout_preference`
(adds `investor_profiles.defaultPayoutDestination` and
`users.mustChangePassword`). That migration was present and already
applied on the real database, and both columns are already used by
this sandbox's own `prisma/schema.prisma` and by real application code
(`app/admin/settings/security/page.tsx`, `lib/actions/auth.ts`,
`lib/actions/investors.ts`), so this was never a schema mismatch or a
missing feature, only a missing file in this sandbox's own copy of the
repo's history. Most likely cause: whichever earlier module first
wrote this migration delivered it straight into the project owner's
folder the same way every module in this project does, but a copy
never made it back into this sandbox's own longer-running working
directory, and this project's git history can't confirm or rule that
out either way, it holds one "wip: module 1 scaffold" commit and
nothing since. Read the file back from the project owner's machine
over the device bridge and restored it into this sandbox's
`prisma/migrations/20260901140414_add_password_and_payout_preference/`,
so the two copies match again.

**Practical takeaway for future modules**: this sandbox's own
`prisma/migrations/` folder cannot be assumed to be the complete,
authoritative migration history, the same way its Prisma Client can't
be assumed to be up to date (Module 48) and its `eslint`/`tsc`/`vitest`
output can't be assumed to be the full picture a real `next build`
would show (Module 31/32/48). When in doubt, a real `migrate status`
or `migrate deploy` run from the project owner's own machine is the
source of truth for what migrations actually exist and what's actually
applied, this sandbox's own copy is a working draft, not the record of
record.

## A real Admin sign-in blocked from ownership transfers, root-caused and fixed for good (Module 51)

Direct report from the project owner's own machine: signed in as Admin,
clicked into Ownership transfers, got "Your role doesn't include
permission to view ownership transfers." A real Admin account hitting a
missing-permission wall is not a cosmetic issue, it was investigated for
a root cause rather than fixed with a one-line workaround.

**What "system role" was supposed to mean, and where the enforcement
gap actually was.** The Admin role is the one row in the `Role` table
with `isSystem: true`. Two places in this codebase already assert, in
plain language, that this means it always holds every permission:
`DEFAULT_ROLE_SEED` in `lib/rbac/permissions.ts` sets `Admin:
Object.values(PERMISSIONS)`, and the role detail screen
(`app/admin/settings/roles/[id]/page.tsx`) tells the viewer "This is a
system role, it always holds every permission and can't be edited,"
showing every single permission with a "Granted" badge regardless of
what the database actually says for that role. Both of those are
seed-time or display-time claims, not an enforced invariant: the
function that actually decides what a signed-in user can do,
`getUserPermissions` in `lib/rbac/check-permission.ts`, read the
`RolePermission` junction table exactly the way it does for any
ordinary, fully-customizable role. Those junction rows only get created
by `npx prisma db seed`. The consequence: the instant a new key is
added to the `PERMISSIONS` catalog in code, every database that isn't
immediately reseeded has an Admin role that is silently missing it,
while its own settings screen keeps insisting the role has everything.
`transfer.verify` and `transfer.approve` are real permissions, present
in the catalog and in `PERMISSION_DESCRIPTIONS`, and `DEFAULT_ROLE_SEED`
does include them for Admin, but the project owner's actual database
had no `RolePermission` row linking either one to their Admin role,
most likely because that database was first seeded before ownership
transfers existed as a feature and was never reseeded afterward, the
same "a step is owed, not just a file" shape as Module 50's migration
gap, just for the seed step instead of the migrate step.

**The fix closes the gap at its root, not just for this one
database.** `getUserPermissions` now checks whether any of the user's
role assignments carries `role.isSystem === true`; if so it returns
`new Set(Object.values(PERMISSIONS))` directly, the fixed, always
in-code-sync catalog, instead of ever consulting junction rows for that
user. `requirePermission` (the real server-side gate every sensitive
Server Action and Route Handler calls) and the mobile API's own auth
layer (`lib/api/auth.ts`) both call this same shared function, so this
one change covers the web app, every server action, and the mobile app
in one place, not three separate patches. The roles list screen's
displayed permission count for a system role
(`getRolesOverview` in `lib/data/rbac.ts`) was also changed from the
raw junction-row count to the fixed catalog size
(`Object.values(PERMISSIONS).length`), so what an admin sees on that
screen agrees with what the role detail screen already claims and with
what authorization actually does now, rather than potentially showing
a number smaller than "every permission" right next to a badge that
says otherwise.

**`npx prisma db seed` is still worth re-running**, it brings the
database's own `RolePermission` rows back in sync and keeps
non-system roles (which this fix deliberately leaves untouched, they
should stay exactly as customizable and junction-row-driven as before)
seeded with their intended defaults, but the app's actual behavior for
the Admin role no longer depends on that step ever having been run, or
re-run after every future permission addition. That dependency was the
entire bug.

## App Lock redesign: no more auto-firing biometric dialog with no escape (Module 52, keke-mobile)

Direct report from the project owner's own device: on a fresh app relaunch, instead of a sign-in screen, the app showed a full-screen fingerprint prompt firing on its own, with the rest of the page still loading behind it and no button or text to get past it if the wrong finger was used or Face ID wasn't available. Separately, tapping "Sign out" was landing back on the sign-in screen rather than the Get Started/welcome screen, so it didn't read as a real, complete sign-out.

**Root cause of the stuck fingerprint dialog.** The old architecture kept a "soft sign-out": `AppLockContext`'s full-screen `AppLockOverlay` auto-fired the native biometric prompt the instant the app detected it should be locked, and the real Supabase session token was deliberately kept alive underneath while a local `locked` flag hid the app behind that overlay. The overlay's own fallback button (the escape hatch) was there in code, but `AppLockProvider`'s hardware-detection and stored-preference read is async, and on a cold relaunch the overlay could mount and auto-fire the native OS dialog before that async check had resolved, so the native dialog visually covered its own fallback button underneath it, with nothing on screen to dismiss it if the wrong biometric was presented.

**The fix retires the auto-firing overlay entirely, not just its button.** `AppLockContext` now exposes an `initializing: boolean` (true until the async hardware-detection/storage read actually resolves), and the two route guards that decide what a relaunch shows — `app/index.tsx`'s `Gate` and `app/(app)/_layout.tsx` — wait for `initializing` before deciding, closing the race condition at its source rather than papering over it with a more visible button. When the app should be locked, both guards now redirect to `/sign-in`, the same screen a fresh sign-in uses, which requires an explicit tap before any native biometric prompt fires and always shows a password fallback alongside it, instead of rendering a full-screen overlay that could auto-fire on its own. `AppLockContext`'s `locked` boolean is now a pure UI gate only, never touching the real session; `session` is never nulled or faked just to lock the screen, closing the "soft sign-out" architecture that caused the confusion in the first place. `markUnlocked()` still pre-arms `unlockedRef.current = true` before an equivalent check completes, preventing a double-prompt stack. `components/app-lock-overlay.tsx` is marked retired in its own module comment and kept on disk unreferenced (this project's file bridge cannot delete files), tree-shaken out of the real bundle.

**Sign out was fixed the same session, same root cause in miniature.** `signOut()` in `src/context/auth-context.tsx` now unconditionally does `await forgetAccount(); await supabase.auth.signOut();`, no soft-lock branch, no options object, always a full, real sign-out landing on `/welcome`. `app/(app)/profile.tsx`'s sign-out confirmation copy was simplified to a plain "Are you sure you want to sign out?" for the same reason, the old copy branched on whether App Lock was enabled to describe a soft sign-out that no longer exists.

Verified by the project owner directly on their own device after the fix shipped: "yes you are right it works." Not verified in this sandbox, which has no phone or simulator attached to `keke-mobile`, the same "Known gaps" limitation every mobile-facing change in this project carries, see the relevant bullet below.

## Transaction alert redesign: branded SMS and email templates (Module 53)

The project owner asked to actually see what the SMS/email alerts looked like today, before approving anything, then supplied two reference screenshots (a structured, field-by-field bank SMS and a Wise/Payoneer-style transfer-receipt email) and asked for Ultimate's own branding, wording, and naming applied to that shape. Two mockup artifacts were built and published for review (current-state and redesign-proposal) before any code changed, and the redesign was approved with four explicit decisions: HTML receipt email, not a PDF attachment; the field-by-field bank-style SMS, not a one-sentence alternative; `"ULTIMATE"` as the SMS sender name stays a placeholder for now (real Termii Sender ID registration is separate, unblocked work); `support@ultimate.africa` stays a placeholder support address for the same reason.

**New `lib/notifications/templates.ts`** is the single source both channels render from, so SMS and email can never drift apart on what a given transaction actually says: `AlertKind` (`"CREDIT" | "DEBIT" | "DECLINED"`), an `AlertDetails` type (`amount`, `reference`, `desc`, optional `balance`/`balanceLabel`, optional `occurredAt`), `shortRef(id, prefix)` (turns a Prisma id into something readable, e.g. `shortRef(id, "RMT-")` → `"RMT-9F2A7C1D"`), `buildAlertSms(alert)` (the approved field-by-field format: kind, `Amt:`, `Bal:` when there is one, `Desc:`/`Reason:`, `Date:`, no sender name repeated in the body since Termii's own Sender ID already shows as who the text is from), and `buildAlertEmailHtml(heading, alert)` (a table-based, all-inline-styles HTML receipt, deliberately not the modern CSS the artifact mockup used, since this renders in real inboxes including Outlook desktop via Resend, not a browser). `smsSafeDesc()` collapses whitespace and truncates free text to 60 characters, since Termii bills per 160-character segment and a long staff-typed decline reason could otherwise silently double the cost of a single alert. `escapeHtml()` is applied to every field that can carry staff-typed free text (a withdrawal-rejection reason, in particular) before it reaches the email HTML, the same kind of injection surface Round seven's security audit already checked everywhere else in this app. `ALERT_SUPPORT_EMAIL` is the one constant the email footer reads from, so filling in the real support address later is a one-line change, not a hunt through every template.

**`lib/notifications/send-notification.ts`** gained an optional `alert?: AlertDetails` on `NotificationInput`: when present, it renders through `buildAlertEmailHtml`/`buildAlertSms` instead of the older plain-text `<p>${body}</p>`/`"${title}: ${body}"` fallback. `title`/`body` are still always stored on the `Notification` row either way, so the admin-facing audit trail keeps reading as a plain sentence regardless of which alert style rendered on the wire.

**Wired into every transaction-alert call site that already existed**, five in total, each with real, correct data rather than a copy-pasted shape: `lib/payments/webhook-handler.ts`'s `handleChargeSuccess` (agent/driver remittance, `CREDIT`, no `balance` field since money lands in a Paystack-held collection account, not an in-app wallet) and `handleInvestorDeposit` (investor wallet top-up, `CREDIT`, with `balance`/`"Wallet balance now"`); `lib/payments/batch-processor.ts`'s `applyTransferOutcome` (bank payout, `DEBIT`, no `balance`, money left to the investor's own bank account) and `applyWalletHold` (wallet-held payout, `CREDIT`, with `balance`); `lib/actions/wallet.ts`'s `approveWalletWithdrawal` (`DEBIT`, with `balance`), `rejectWalletWithdrawal` (`DECLINED`, with `balance`), and `fundVehicleFromWallet` (`DEBIT`, with `balance`). Each site captures its own transaction id (`paymentTransactionId`, `withdrawal.id`, `contract.id`) for `shortRef()` rather than inventing one.

**One real wording bug caught and fixed along the way, not just carried over from the mockup**: the declined-withdrawal alert now says `"Still in your wallet"` rather than something implying funds were "returned," since `rejectWalletWithdrawal`'s own doc comment already establishes that a `PENDING_APPROVAL` request is never actually debited before staff act on it, there is nothing to return, the money never left. The published mockup artifact used "Funds returned to wallet" for that same case; the real implementation does not repeat that inaccuracy, the mockup was not retroactively corrected since it was only ever a proposal, not a shipped surface.

Not verified against a real Resend/Termii send from this sandbox (no live credentials, no network egress for either), each file was syntax-checked with `esbuild` and each edit read back directly against the real file before being committed. See "Known gaps" for the separate, pre-existing gap this doesn't change: `RESEND_FROM_EMAIL` and `TERMII_API_KEY`/`TERMII_SENDER_ID` still need real values in the project owner's production environment before either channel actually delivers, this module only changed what gets rendered once a send is attempted, not whether a send can happen at all.

## BVN/NIN stepped down on the client's explicit request (Module 54)

Module 46 (see "Known gaps" below) had added an automated BVN/NIN check against Dojah on `/kyc`, a signal for staff, never an automated approve/reject gate. That module shipped before `client-decisions-log.md` decision #2 was reconfirmed directly by the project owner this round: BVN/NIN are not going to be used at all, identity verification stays document-only, a government ID and a proof of address, reviewed by staff, exactly what the decision log already said this project's scope was supposed to be. This module brings the actual code back in line with that decision, rather than leaving the two out of sync.

**Every real reference was grepped for and addressed, not assumed**: `\bbvn\b|\bnin\b|dojah` (case-insensitive) across the whole `keke-platform` tree turned up 14 files, 12 code files plus this doc and `README.md`. `app/kyc/identity-form.tsx` lost the entire BVN/NIN `<form>`, its two status badges, and the "Save BVN & NIN" button, along with the `useActionState` wiring built around it; `app/kyc/page.tsx`'s prop to `IdentityForm` was trimmed to just `kycStatus`. `app/kyc/actions.ts` (the BVN/NIN save action, `submitIdentityDetails`) and `lib/verification/identity-check.ts` (its Dojah bridge) are both marked RETIRED in their own header comments and left working but unreferenced, kept on disk rather than deleted since this project's device bridge has no delete capability, the same pattern `components/app-lock-overlay.tsx` already established in Module 52 above. `lib/verification/dojah-client.ts` and its test were left untouched, further downstream and equally unreferenced now.

**One real behavioral gap had to be closed, not just UI removed.** `uploadKycDocument` (`lib/actions/kyc.ts`) never itself moved an investor's overall `kycStatus` to `PENDING_REVIEW`, that was always `submitIdentityDetails`' job, done on every BVN/NIN save. Deleting the BVN/NIN form without replacing that would have meant no path ever put a fresh investor into `PENDING_REVIEW` again (their documents would still surface in staff's queue, `getKycQueue`'s `OR` clause already covers a pending document independently of `kycStatus`, but `/kyc`'s own "Submitted, awaiting review" step label would never show, since that reads `kycStatus` directly). `uploadKycDocument` now sets `kycStatus: "PENDING_REVIEW"` on every successful upload, taking over that responsibility, the same unconditional-on-every-submission behavior the retired action always had.

`lib/data/kyc.ts`'s `getKycQueue`/`getInvestorKycDetail` no longer return `hasBvn`/`hasNin`/`bvn`/`nin`/`bvnVerificationStatus`/etc; `app/admin/kyc/page.tsx` lost its "BVN / NIN on file" column; `app/admin/kyc/[investorId]/page.tsx` lost the entire "Submitted identity details" BVN/NIN card (replaced with a slim email-only card) along with the now-unused `VERIFICATION_STATUS_VARIANT`/`_LABEL` consts, and its "Overall decision" copy no longer tells staff to review a BVN/NIN that no longer exists. `.env.example`'s Dojah section is marked STEPPED DOWN and its three variables commented out rather than deleted, left as a pointer in case this is ever revisited rather than silently vanishing. `prisma/schema.prisma`'s `bvn`/`nin`/`VerificationStatus` columns and enum were deliberately left in place: dropping them needs a real migration, and this sandbox still cannot reach `binaries.prisma.sh` to generate one (see "Known gaps" below), a schema cleanup is safe to leave for whenever a migration is already in flight for something else, not urgent enough to justify a dedicated one now. Any BVN/NIN values already stored on an existing database row are untouched either way.

Every touched file was syntax-checked with `esbuild` (this sandbox's own `tsc`/`next build` limitations are unchanged, see "Known gaps"), and each edit was read back directly against the real file before being committed to the project owner's machine, not assumed correct from the diff alone.

## Content-Security-Policy robustness pass (Module 55)

Direct ask from the project owner to check the CSP header (added in Module 45, see "Known gaps" below for that module's own disclosure that it was never verified against a real browser) and hardened it further, rather than leaving "watch the browser console" as the only way anyone would ever find out it broke something.

**Full re-read of `proxy.ts`'s `buildCspHeader` against what this app actually loads, confirmed rather than re-derived from scratch**: `script-src`/`style-src` nonce and `'strict-dynamic'` wiring, `connect-src`'s Supabase-project and Sentry scoping, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` were all re-checked against the real codebase and found correct as already documented. `img-src 'self' blob: data:` specifically re-verified against a fresh grep for `next/image` remote usage and any Supabase Storage read rendered as an `<img>`: this app has neither, `next.config.ts` sets no `images.remotePatterns` at all, the one image component (`components/auth/auth-hero-carousel.tsx`) only ever renders local bundled assets, and the one Supabase Storage read in the app (a KYC document's signed URL) opens as a plain link in a new tab, not a same-page resource load, so nothing here needed widening.

**Two real changes came out of the pass.** First, the nonce itself: it was previously `Buffer.from(crypto.randomUUID()).toString("base64")`, base64-encoding a UUID's 36-character hyphenated text form. That worked (a v4 UUID still carries 122 random bits, genuinely unique and unguessable per request), but it wasn't the textbook construction CSP guidance describes. Now `Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64")`, 128 raw random bits straight from the Web Crypto CSPRNG, base64-encoded directly. Deliberately `crypto.getRandomValues`, not Node's `crypto.randomBytes`: this file runs on the Edge Runtime (it is Next's `proxy.ts`/middleware convention), which does not have Node's `crypto` module, only the Web Crypto API the original code was already implicitly relying on via `crypto.randomUUID()` being one method on that same global interface.

Second, and the more substantial change: CSP violation reporting. Before this, a violation in production was invisible to anyone unless a developer happened to open the browser console on the exact page where it happened. New `app/api/csp-report/route.ts`, a same-origin, deliberately unauthenticated Route Handler (a browser sends these on its own, no session, nothing to authenticate, the same shape as the Paystack webhook route next to it in `app/api/`) that parses either report shape a browser can send (the older `report-uri` form, `Content-Type: application/csp-report`, and the newer Reporting API's `report-to` form, `Content-Type: application/reports+json`) and forwards each one to Sentry via `Sentry.captureMessage`, fingerprinted on the violated directive and blocked URI so Sentry's own issue grouping collapses repeated identical violations into one issue rather than one alert per report, the same grouping behavior every other `Sentry.capture*` call in this app already relies on rather than this app rolling its own dedup layer. `proxy.ts`'s CSP header now sends both `report-uri /api/csp-report;` and `report-to csp-endpoint;`, paired with a new `Reporting-Endpoints: csp-endpoint="/api/csp-report"` response header that defines where the `report-to` group actually points, per the Reporting API spec. A public, unauthenticated report endpoint can in principle be hit directly to generate noise; that is a known, industry-standard tradeoff of any CSP report endpoint and was not treated as something to solve here ahead of it ever actually mattering.

Not verified against a real running browser, the same limitation every change to this file has carried since Module 45, this sandbox has none attached. Both files were syntax-checked with `esbuild`. The project owner doing one real click-through after this ships is still worth it, especially sign-in/sign-up/MFA (the paths that talk to Supabase straight from the browser) and the QR code step, but from here on a missed case reports itself to Sentry afterward instead of depending on that one click-through catching it.

## Agent/driver portal access flag (Module 58)

**A real, surfaced conflict, resolved by explicit confirmation, not code deleted or guessed at.** `client-decisions-log.md` decision #1, made during the proposal/negotiation work tracked in this project's Claude Desktop docs, records the client confirming agents and drivers get no self-service platform access at all, web or mobile, remittances and deposits managed entirely by staff through per-account Paystack dedicated virtual accounts. That decision predates, and directly conflicts with, this codebase's actual state: `keke-mobile`'s agent and driver Home/Fleet/Wallet dashboards (Module 37/round six/round eight) and `keke-platform`'s own `/agent/*`/`/driver/*` portals are fully built, and Module 56/57 (see `keke-mobile/README.md`) just added offline caching to every one of those screens, more investment in exactly the surface area the client said they didn't want self-service access to.

Surfaced directly rather than silently built around or silently removed: asked the project owner, who confirmed the decision stands (agents/drivers should have no access right now) but explicitly wants the built portals kept intact rather than deleted, specifically so that if the client changes their mind later, turning access back on is a configuration flip, not a rebuild of two portals across two codebases from scratch.

**Implementation: one flag, defaulting to today's actual live behavior (enabled), not a change in production behavior on its own.** `lib/config/portal-access.ts`'s `isAgentDriverPortalEnabled()` reads `AGENT_DRIVER_PORTAL_ENABLED`, `!== "false"` so unset (the state of every deployment right now, this variable is new) keeps behaving exactly as before this module, agent/driver access stays on. Wired into every place an agent/driver account currently gets into a portal, mirroring the existing staff/admin mobile block (`STAFF_PORTAL_NOT_SUPPORTED`, Module 34/round seven) pattern exactly rather than inventing a new one:
- `resolvePortalDestination` (`lib/actions/auth.ts`): a web sign-in's redirect target. An agent/driver account whose password is completely correct now gets a clear `{ error }` result here when the flag is off, staying on `/sign-in` with an honest explanation, rather than a redirect-then-bounce-back through `/agent/dashboard`.
- `GET /api/v1/me` (`app/api/v1/me/route.ts`): the mobile app's own gate, returns `403 AGENT_DRIVER_PORTAL_DISABLED` when off, the exact same shape and reasoning as the staff block three lines above it in that file.
- `app/agent/layout.tsx`/`app/driver/layout.tsx`: defense-in-depth, not the primary path, a `redirect("/sign-in")` for a session that was already signed in before the flag flipped, or a direct/bookmarked URL.
- `keke-mobile/src/context/auth-context.tsx`'s `AuthProvider`: reacts to the new `AGENT_DRIVER_PORTAL_DISABLED` code exactly like it already reacts to `STAFF_PORTAL_NOT_SUPPORTED` — force-signs the device out, shows `blockedMessage` on `/sign-in`, nothing quick-resumable for an account the flag has turned off.

`.env.example` documents `AGENT_DRIVER_PORTAL_ENABLED` (commented out, `=false` as the example value showing what turning it off looks like). To actually disable agent/driver sign-in for real: set `AGENT_DRIVER_PORTAL_ENABLED=false` in the deployment's environment variables and redeploy, an ordinary env-var change, not a code change; unset it (or delete the variable) to turn access straight back on, same deal in reverse. Every screen and route behind this flag is untouched and still fully working, this only gates the door.

Not verified against a real running app, checked with `esbuild` syntax checks on every touched file in this sandbox only, same limitation as every other change this round. Worth a real click-through of both flag states from the project owner's own machine before this is ever actually flipped for real: sign in as an agent/driver with the flag off (web and mobile, confirm the clear message shows and no dashboard leaks through), then with it back on (confirm nothing regressed from before this module).

## Staff-facing agent/driver admin tools: management proxy, cash capture, delinquency alerts, staff-driven KYC, dispute/reversal (Module 59)

**Another real, surfaced scope mismatch, this time the opposite shape from Module 58's.** Module 58 found code doing more than a client decision said it should (self-service portals the client had decided against). This one is the reverse: `missing-features-agent-driver-restructure.md` in this project's Claude Desktop docs lists five staff-facing admin features that were written into the sold ₦22,000,000 proposal as the explicit replacement for agent/driver self-service — the idea being staff manage agents/drivers from the Admin Console instead of agents/drivers managing themselves. That doc's own "BUILT" label turned out to mean "written into the proposal `.docx`", not "exists in this codebase" — grep and direct file inspection confirmed none of the five existed in code before this module. Surfaced to the project owner rather than silently built or silently left alone; the explicit instruction back was to build all five now. This module is that build, plus the plumbing all five needed in common.

**1. Agent/driver management proxy screens.** `app/admin/drivers/[id]/page.tsx` was a bare edit form before this module, no deposit history, no collection account, no standing, despite the underlying data (`getDriverDeposits`, `Driver.paystackDva*`) already existing. It's now a full proxy view mirroring the agent detail page's own Module 51 shape on purpose: total received / last deposit / deposit count cards, the edit form, account access, collection account, an identity-verification card, a cash-deposit form, and a deposit history table with reversal buttons — same structure `app/admin/agents/[id]/page.tsx` already had, now with the same four additions layered on top of it (delinquency badge, KYC card, cash-remittance form, reversal buttons on the remittance table). Both list pages (`/admin/agents`, `/admin/drivers`) got a new "Standing" column (Current / delinquency badge / "No remittances yet" — the last one deliberately distinct from delinquent, a brand-new account isn't late).

**2. Manual/cash remittance capture.** `lib/actions/manual-payments.ts`'s `recordManualPayment` creates a `PaymentTransaction` exactly like an electronic Paystack webhook does — `direction: INBOUND`, `source: MANUAL_ADJUSTMENT` (defined on the `PaymentSource` enum since Module 14 or so, never actually used anywhere until now), `providerTransactionId: null` (the tell for "no webhook behind this one"), a required `note` (why/how it was received) and `recordedById` (which staff member entered it) — and allocates it against the earliest unpaid schedule entry via `findEarliestUnpaidScheduleEntry`, the exact same helper `matchProviderTransaction` uses for an electronic remittance, so a cash entry and a Paystack one land identically once recorded. Gated on `RECONCILIATION_VIEW` (reused, not a new permission, see the RBAC note below) plus `user.staff` required. The `ManualPaymentForm` component is on both detail pages now.

**3. Proactive delinquency alerts.** `lib/delinquency.ts` is the one definition of "late" used everywhere: `isDelinquent(lastPaidAt)` is true once 7 flat days (`DELINQUENCY_THRESHOLD_DAYS`, hand-picked, not derived per-contract from `PaymentFrequency`) have passed since the last inbound payment, false for an account that has never paid at all (distinct from "0 days ago", surfaced separately as "No remittances/deposits yet" rather than flagged red). No cron exists anywhere in this codebase (confirmed by grep, `lib/schedule.ts` is pure date-math) so this is computed live, via `groupBy`/`_max(createdAt)`, everywhere it's shown: the agent/driver list pages' Standing column, the agent/driver detail pages' header badge, and now `lib/data/admin.ts`'s `getNeedsAttention()` (the dashboard's existing "Needs attention" card, previously only unmatched-Paystack/deferred-payment/target-achieved items) via two new live counts, `getDelinquentAgentCount()`/`getDelinquentDriverCount()`.

**4. Staff-driven KYC/onboarding entry.** Agents and drivers never sign in to upload anything themselves (Module 58's own decision), so `lib/actions/agent-driver-kyc.ts` is the staff-does-it-on-their-behalf counterpart to `/kyc`'s investor-facing `IdentityForm`: `uploadAgentDriverDocument` (staff enters a government ID or proof of address the subject physically handed over, gated `STAFF_MANAGE`/`FLEET_MANAGE` by subject type), `reviewAgentDriverDocument` (per-document verdict) and `reviewAgentDriverKyc` (overall verdict, sends a notification if the subject has app access), both gated `KYC_REVIEW` — same maker-checker shape the investor flow already has, both sides staff-driven instead of one side self-service. New table `AgentDriverDocument` plus `Agent.kycStatus`/`Driver.kycStatus` (both `KycStatus`, default `NOT_STARTED`; nothing moves either automatically, a staff review is what changes it). No separate `/admin/kyc`-style queue page for agents/drivers — review happens directly on the subject's own detail page instead, via the new `AgentDriverKycCard` component on both.

**5. Dispute/adjustment tool with audit trail.** `lib/actions/manual-payments.ts`'s `reversePaymentTransaction`: refuses an already-reversed transaction or one with neither `agentId` nor `driverId`; inside a `$transaction`, unwinds each `PaymentAllocation` (decrementing `scheduleEntry.amountPaid` and re-deriving `UPCOMING`/`PARTIALLY_PAID` — deliberately not attempting `DUE`/`OVERDUE`, that recomputation is `reports.ts`'s own live logic and duplicating it here risked drifting out of sync), decrements `contract.totalPaidToInvestor`, deletes the allocation rows, and sets the transaction to `status: REVERSED` with the reason as its `note`. Full before/after audit log via `writeAuditLog()`, same as every other mutating action in this codebase. Gated `RECONCILIATION_VIEW`. The `ReversePaymentButton` component sits on both detail pages' history tables, collapsed to a small link by default, expands in place to a reason field so the row stays in view while staff type it.

**RBAC: no new permissions.** Every gate above reuses an existing `PERMISSIONS` key whose semantics already cover the new action, rather than inventing a new key that would need a `npx prisma db seed` reseed to become assignable (unrunnable from this sandbox): `RECONCILIATION_VIEW` for both manual-payment actions (precedent: `matchProviderTransaction`/`dismissProviderTransaction` already gate mutating actions on this same permission), `STAFF_MANAGE`/`FLEET_MANAGE` for agent/driver document upload, `KYC_REVIEW` for document/KYC review decisions.

**Migration owed.** `prisma/migrations/20260929120000_add_agent_driver_kyc_and_manual_payments/migration.sql` is hand-written, same reason every migration since Module 49 has been (see "Prisma CLI" under Known gaps: no reach to `binaries.prisma.sh` from this sandbox). It adds `agents.kycStatus`/`drivers.kycStatus`, the new `agent_driver_documents` table (a CHECK constraint enforces exactly one of `agentId`/`driverId` per row, both FKs `ON DELETE CASCADE`), and `payment_transactions.note`/`payment_transactions.recordedById` (both nullable, additive, no existing data touched). **Run `npx prisma migrate deploy` then `npx prisma generate` on a real machine before any of this module's code paths will actually work against the database** — until then `prisma.agentDriverDocument`, `agent.kycStatus`, `driver.kycStatus`, `paymentTransaction.note`, and `paymentTransaction.recordedById` exist in the schema and the TypeScript types but not yet in the live database.

Every touched and new file was syntax-checked with `esbuild` in this sandbox (same `tsc`/`next build` limitation as every other module, see Known gaps) and read back directly against the real file on the project owner's machine after committing, not assumed correct from the diff. Not verified against a real running app or a real click-through — worth exercising, once the migration above is actually deployed: upload a document and review it to Verified/Rejected on both an agent and a driver, record a cash remittance/deposit and confirm it shows in the history table and (if the subject has app access) triggers the SMS/email alert, reverse one and confirm the schedule entry and running totals unwind correctly, and check the dashboard's "Needs attention" card and the list pages' Standing column both reflect a deliberately-aged test account correctly.

## The client's real logo, implemented everywhere branding appears, web and mobile (Module 60)

**Not a rebrand.** The client sent over a full brand sheet PDF (horizontal/stacked lockups, icon-only mark, a circular badge, each in full color and reversed white-on-blue). Every placement in both repos up to this point used `KekeIcon`, a generic tricycle silhouette that was always a placeholder standing in for a real mark. This module swaps that placeholder for the client's actual logo everywhere it was being used as branding, and leaves the rest of the app's gold/charcoal UI design system untouched — the project owner was explicit this is a logo swap, not a color-scheme change.

**Treatment decided with the project owner: full-color everywhere, cropped per container.** The brand sheet is blue+gold; this app's existing design system is gold+charcoal with no blue anywhere else. Rather than picking a reversed/white version for dark surfaces and a color version for light ones (which the project owner considered and rejected in favor of one consistent treatment), every placement uses the same full-color, transparent-background icon, on a small white "plate" wherever the surrounding surface is dark, and directly on light surfaces where it already sits on `bg-white`/`bg-surface`. This mirrors a pattern already established through most of the app's existing branding spots (`bg-white` badge + wordmark).

**A derivation attempt was abandoned rather than shipped broken.** The reversed (white-on-blue) PDF asset was briefly considered for dark-surface placements, chroma-keyed to pull a transparent white mark off its blue background. That failed: the flame element in the mark pokes outside the shield and is pixel-connected to the surrounding blue background (confirmed with `scipy.ndimage.label` — one connected component spans both), so any global color-key or flood-fill also erased part of the flame. Rather than hand-patch a broken derived asset, every placement instead uses the genuine, unmodified full-color source on a light backing plate — simpler, and it means nothing in this codebase touches the client's actual colors.

**Web (`keke-platform`), 6 files:**
- `components/layout/app-shell.tsx` — both the desktop sidebar header and the mobile top bar now render `/public/brand/logo-horizontal.png` directly (both surfaces are already light, no backing plate needed), replacing the `bg-accent` box + `KekeIcon` + "Ultimate" text.
- `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/forgot-password/page.tsx` — the existing `bg-white` badge box on the auth hero carousel now holds `/public/brand/icon.png` in place of `KekeIcon`.
- `app/admin-sign-in/page.tsx` — same swap, box changed from `bg-accent` to `bg-white` (with a `ring-1 ring-border` for edge definition against the surrounding `bg-surface` card) since the icon's own colors only read on a light plate. `KekeWatermark` (decorative background texture, unrelated component) was left untouched — confirmed still referenced before removing only the `KekeIcon` import.
- `app/opengraph-image.tsx` (the social-share preview image) — the gold box + bell SVG placeholder is now the real icon, read via `readFile` and base64-encoded the same way the two font files already are, on a white box in place of the gold one.
- New asset files: `public/brand/icon.png` (full-color, transparent, ~551×736), `public/brand/logo-horizontal.png` (full-color, transparent, ~1787×483), `app/favicon.ico` (multi-size 16/32/48/64, padded onto a square canvas first — the source lockup isn't square, and letting the ICO encoder scale-to-fit a non-square source silently produces non-square icon entries).

**Mobile (`keke-mobile`), 2 screens + app icon config:**
- `src/app/welcome.tsx`, `src/app/sign-in.tsx` — the identical `styles.badge`/`styles.heroBadge` white box (already `colors.white`, unchanged) now holds an `<Image source={require('@/assets/images/brand-icon.png')} />` in place of `<KekeIcon color={colors.accent} />`. `KekeIcon` is still genuinely used elsewhere in this repo (the "Fleet" tab bar icon in `src/app/(app)/_layout.tsx`) and was left alone — only the branding usages were touched.
- `app.json` — `android.adaptiveIcon.backgroundColor` changed from `#1F1A12` to `#FFFFFF`; the adaptive icon foreground is the full-color icon on transparent (Android safe-zone-scaled), and needs a light plate behind it for the same reason every other placement does.
- New/replaced asset files under `assets/images/`: `icon.png`/`favicon.png`/`splash-icon.png` (opaque white square, full-color icon centered — app icons need an opaque background), `android-icon-foreground.png` (transparent, Android safe-zone scaled), `android-icon-background.png` (flat white), `android-icon-monochrome.png` (solid white fill on the icon's own alpha shape, for Android 13+ themed icons), `brand-icon.png` (small in-app badge use, full-color, transparent — what the two screens above reference).

**One thing said out loud that turned out wrong, corrected here for the record.** Earlier in this same conversation, before any pixel analysis was done, the reversed (white-on-blue) variant was described to the project owner as having gold that "really pops." Direct pixel-histogram analysis afterward showed that's false — the reversed asset is a pure two-tone blue+white mark, no gold pixels at all. Every decision from that point on (including the choice to abandon deriving a reversed asset, above) was based on the corrected, verified color data, not the earlier incorrect claim, but the claim itself was never explicitly retracted to the project owner in conversation. Flagging it here since it was stated as fact and should not be treated as one.

**Every changed file syntax-checked with `esbuild`** (web `.tsx` and mobile `.tsx`/`.json`, this sandbox's usual substitute for a real `tsc`/`next build`/`expo` build, see Known gaps). Every committed file — code and image assets — was re-staged from the device after commit and checked byte-for-byte (text/JSON) or pixel-for-pixel (images, via Pillow; a few PNGs came back a different byte size after the round trip through the device but decoded to identical pixel data, i.e. re-encoding somewhere in the transfer path, not data loss) against what was sent. Not verified against a real running app or a real click-through in either repo — worth doing once there's a moment: load `/sign-in`, `/admin-sign-in`, and the dashboard sidebar in a browser, and the mobile welcome/sign-in screens plus a rebuilt app icon on a device or simulator, to confirm the logo actually renders where expected at the sizes chosen here.

## Known gaps (accurate as of this writing)
- **This sandbox has never had a real browser attached to this app,
  and that is a real, demonstrated gap, not a theoretical one.** Every
  automated check this sandbox can run (`npx eslint .`, `npx tsc
  --noEmit`, `npx vitest run`) checks types, lint rules, and unit-level
  logic, none of them actually render this app's component tree the
  way a browser does. Module 47's `ActionForm` crash (see "ActionForm
  crash fix (Module 47)" above) is the concrete proof: a real,
  reproducible runtime crash on 20 different pages, invisible to every
  check this sandbox ran across three earlier modules, caught only
  once the project owner actually clicked into the app in their own
  browser. Nothing currently planned closes this gap from inside this
  sandbox, it has no reach into a real browser environment; the
  practical mitigation is the same one that just worked, a real
  click-through after any change that touches how a Server Component
  and a Client Component hand off children or props to each other,
  the specific shape this bug lived in.
- **Raised in Module 34, started in Module 35, extended in Module 37,
  agent closed in round six, staff intentionally excluded round seven,
  driver closed round eight**: `app/api/` held exactly one route before
  Module 35, the Paystack webhook, everything else in this app is a
  Server Action or a Server Component fetch, reachable only from this
  app's own pages. `lib/api/auth.ts` (`authenticateApiRequest`),
  `GET /api/v1/me`, `GET /api/v1/investor/summary`,
  `GET /api/v1/agent/summary` (round six), and now
  `GET /api/v1/driver/summary` plus `GET /api/v1/driver/deposits`
  (round eight) are the versioned routes and the bearer-token auth
  built so far, see "Mobile / external API" above for the full shape.
  Every portal that has a mobile presence now has its own endpoint;
  staff is not a gap to close, round seven deliberately blocks
  staff/admin accounts from `GET /api/v1/me` on purpose, see the round
  seven entry above, this is a finished decision, not an unfinished
  one.
- **Server-side enforcement of the round seven staff/admin mobile
  block is client-app-level only, not IdP-level.** The real
  enforcement point, `GET /api/v1/me` refusing a staff/admin token, is
  server-side and cannot be bypassed by a modified or different mobile
  client calling the real API. What is client-app-level is the
  reactive part: `keke-mobile`'s own `AuthProvider` is what notices the
  refusal and force-signs the device out, see the round seven entry
  above. A Supabase Auth Hook configured to refuse the sign-in itself,
  before any client-side code runs at all, would be one layer stronger
  still, but that needs Supabase project dashboard configuration this
  sandbox has no reach into, not something achievable from inside this
  codebase alone.
- **Resolved, Module 36 (sign-in), extended Module 37 (investor
  dashboard), extended round six (agent), extended round eight
  (driver)**: the mobile app is no longer just guidance, `keke-mobile`
  is a real scaffolded Expo project with working sign-in and, for
  investor accounts, a real Home/Fleet/Wallet backed by
  `GET /api/v1/investor/summary`, see "The mobile app's investor
  dashboard (Module 37)" above, for agent accounts, a real
  Home/Fleet/Wallet backed by `GET /api/v1/agent/summary`, see the
  round six entry above, and now, for driver accounts too, a real
  Home/Fleet/Wallet backed by `GET /api/v1/driver/summary` and
  `GET /api/v1/driver/deposits`, see the round eight entry below. Every
  portal that can sign into `keke-mobile` at all (investor, agent,
  driver) now has a real dashboard, none left showing the Module 36
  "coming soon" placeholder. Staff/admin accounts are no longer an open
  item here at all, round seven blocks them from this app entirely on
  purpose, see above.
- **Resolved, round six**: the mobile sign-in screen's magic-link button
  was a "not available yet" placeholder, `checkMagicLinkBlocked` (Module
  34, `lib/actions/auth.ts`) only existed as a Server Action, unreachable
  from `keke-mobile`. New `POST /api/v1/auth/check-magic-link` route
  wraps it (see the round six entry above), and the mobile button now
  calls it before `supabase.auth.signInWithOtp`, the same order the web
  sign-in page's own magic-link button already uses, so an account with
  two-factor authentication turned on still can never get a magic link
  that would skip its second factor, on either app.
- **Raised in Module 36, not started**: `keke-mobile` has no EAS
  project, no Apple Developer or Google Play account, and has not been
  built or submitted anywhere, it currently only runs through Expo Go
  or a local simulator/emulator on the project owner's own machine.
  See `keke-mobile/README.md`'s "Before you can actually publish this"
  section for the concrete list of what real store distribution needs.
- **Module 30, disclosed on purpose, not discovered later; narrowed round
  seven ("fix the password stuff"); resolved Module 45, researched rather
  than assumed.** Resetting an investor, driver, staff, or agent's
  password from the "Account access" card on their edit page
  (`resetInvestorPassword`/`resetStaffOrAgentPassword`/
  `resetDriverPassword`, all calling `auth.admin.updateUserById` with a
  new password, the service-role Admin API) was flagged as possibly not
  signing that account out of any device it was currently signed in on,
  round seven having been unable to get authoritative confirmation of
  what GoTrue does to existing sessions on an admin-initiated password
  change. Module 45 got that confirmation: current Supabase Auth
  (GoTrue) server behavior, checked against supabase/auth GitHub issue
  #1579 ("Updating a user's password kills their session," open at the
  time of checking), is that `updateUserById` with a new password now
  immediately kills that user's existing session, a change from older
  GoTrue versions that is not an officially documented contract but is
  real and current on hosted Supabase projects, which auto-update to
  the latest server version. Since every deployment of this app runs on
  a hosted Supabase project, all three admin-reset paths already get
  this behavior with no code change needed. Worth a real check on the
  project owner's own project regardless, since this rides on
  Supabase's own server behavior rather than a contract this app
  enforces itself: reset a password from the admin panel while signed
  in as that user on a second device or browser, confirm that second
  session gets kicked immediately. The **self-service** reset flow at
  `/reset-password` (the page Supabase's own emailed recovery link
  lands on) has, since round seven, additionally called
  `supabase.auth.signOut({ scope: "others" })` right after its own
  password update succeeds, a stronger, code-guaranteed version of the
  same protection available only there because that flow genuinely has
  a live session for the account to call it from, something the
  admin-initiated path never has.
- **Round seven security audit, disclosed on purpose; all three findings
  addressed Module 45.** A systematic pass (every Server Action's
  permission check, every `/api/v1` route's ownership scoping, raw-SQL
  and `dangerouslySetInnerHTML` surface, the webhook signature check),
  see the round seven README entry for the full method and what it
  confirmed was already solid. Three findings came out of it that this
  sandbox could not safely fix blind at the time, disclosed rather than
  force-fixed:
  - **`npm audit`: 3 high in keke-platform, 14 moderate in keke-mobile,
    none in runtime-reachable code. Resolved Module 45, keke-platform
    now at 0, keke-mobile now at 3 (the remaining 3 disclosed, not
    silently dropped).** keke-platform's three were `deepmerge-ts`
    (stack exhaustion) via `@prisma/config`/`prisma`, fixed with a
    targeted `"overrides": { "deepmerge-ts": "^8.0.2" }` in
    `package.json` after confirming an identical CJS/ESM export shape
    between versions, rather than the Prisma downgrade `npm audit fix
    --force` would have forced. keke-mobile's fourteen collapsed to
    three: `uuid` (via `xcode`/`@expo/config-plugins`/
    `expo-splash-screen`) fixed the same way, `"overrides": { "uuid":
    "^11.1.1" }`, confirmed safe with a scratch-project `require()`
    smoke test, which also resolved every other finding that was only
    "vulnerable" because it depended on that same `uuid` chain. The
    remaining three (`decode-uri-component`, `query-string`,
    `expo-router`) are still open on purpose: `decode-uri-component`'s
    only non-vulnerable release, `0.5.0`, dropped CommonJS support
    entirely (confirmed with the same kind of smoke test), and
    `query-string@7.1.3` requires it with plain `require()`, so
    overriding it would be a real, unverifiable-in-this-sandbox breaking
    change, correctly left alone rather than forced. See "Hardening pass
    (Module 45)" above for the full detail on both projects.
  - **`keke-mobile`'s Supabase session (the bearer tokens behind every
    signed-in screen and every `/api/v1` call) is stored in a plain,
    unencrypted JSON file. Resolved Module 45.** `src/lib/file-storage.ts`
    (backed by `expo-file-system`, not the OS keychain/keystore) is now
    only ever handed ciphertext: new `src/lib/secure-session-storage.ts`
    implements Supabase's documented "LargeSecureStore" pattern, a fresh
    random AES-256 key generated on every write, held in
    `expo-secure-store` (hardware keychain/Keystore-backed, comfortably
    under its size limit), encrypting the actual session blob before it
    reaches `file-storage.ts`. `src/lib/supabase.ts`'s `auth.storage` now
    points at `SecureSessionStorage`. Verified with `tsc`/`eslint`, not
    on a real device, this sandbox has none attached to `keke-mobile`,
    see "Hardening pass (Module 45)" above for the concrete on-device
    check still worth doing (sign in, force-quit, relaunch, confirm the
    session survives).
  - **No Content-Security-Policy. Resolved Module 45.** `proxy.ts` now
    generates a fresh nonce every request and sets a real
    Content-Security-Policy header built specifically for what this app
    actually loads (checked directly, not templated), read back in
    `app/layout.tsx` and applied to the one inline `<script>` this app
    ships (the Module 42 theme-init script). The five response headers
    `next.config.ts` already set are unchanged and still there
    alongside it. See "Hardening pass (Module 45)" above for every
    directive and the reasoning behind each one; not verified against a
    real running browser, this sandbox has none attached to this app,
    worth watching the browser console for CSP violation reports after
    this ships.
- **Resolved, Module 34**: the two-factor authentication challenge added
  to `/sign-in` and `/admin-sign-in` only covered the password sign-in
  path, disclosed on purpose at the time in Module 30 rather than left
  for someone to find by trying it. The "send a login link by email"
  magic-link option on `/sign-in` (`supabase.auth.signInWithOtp`) signed
  the browser straight in on a clicked link, with no code prompt in
  between, even for an account that had a verified authenticator app
  factor. Closed by disabling magic-link sign-in for any account with
  MFA turned on (the first of the two options this entry originally
  named), see "Account security" above for `checkMagicLinkBlocked`.
- The CAR and BIKE default contract terms start out as placeholders, not
  confirmed by the business, see "Locked business rules" above. This is
  now something the admin can fix directly at
  `/admin/settings/contract-terms` rather than needing a code change,
  once real numbers come in from the business.
- **Superseded, Module 54: stepped down entirely, not just left partially
  resolved.** Module 46 had BVN and NIN typed into `/kyc` automatically
  checked against Dojah the moment either value changed, see "BVN/NIN
  verification (Module 46)" above for the full vendor research,
  architecture, and caveats that entry originally raised (never tested
  against a live Dojah account, no confirmed NIMC/NIBSS partner status,
  the unresolved SEC crowdfunding-intermediary registration question).
  None of that is a live gap to track anymore: the project owner
  confirmed directly, per `client-decisions-log.md` decision #2, that
  BVN/NIN are not being used at all, and Module 54 (see above) removed
  the fields, the Dojah check, and every staff-facing display of either
  from the real app. Identity verification on `/kyc` is document-only
  now. This bullet is kept, rather than deleted, as the historical
  record of why the Dojah integration exists on disk (`lib/verification/
  dojah-client.ts` and its test, both retired but not deleted, see
  Module 54) even though nothing calls it anymore.
- This project has only ever been checked with `npm run lint` from inside
  this sandbox, `tsc` is unreliable here, that half of this gap is
  permanent. Module 45 fixed the specific reason `next build` itself
  couldn't run here at all (Google Fonts being unreachable at build
  time, `next/font/google` swapped for a self-hosted `next/font/local`,
  see "Hardening pass (Module 45)" above), and a real `npm run build`
  now gets past that and into Next's own type-checking step, further
  than it has ever reached in this sandbox. It still cannot finish here,
  though: `npx prisma generate` is also blocked from reaching
  `binaries.prisma.sh` in this sandbox (a separate, already-known limit,
  reconfirmed this round), which leaves the checked-in Prisma Client
  stale enough that the type-check step fails on that staleness, not on
  anything new. That second half of this gap is permanent for the same
  reason the first half used to be: it needs real network access this
  sandbox's egress policy doesn't allow, no code change closes it from
  in here. On the project owner's own machine, `npx prisma generate`
  then `npm run build` should now complete cleanly, since the blocker
  this sandbox could never work around either way is gone. Module 18 ran
  a real `next build` for the first time while verifying its own changes
  and found (and fixed) a build-breaking bug unrelated to that module,
  see its README entry. **Module 31, a full pass, resolved**: the project owner
  ran `next build` for real from their own machine three times in a row.
  First run: eight real type errors across three files, all genuine
  bugs, none false positives (see the Module 31 README entry). Second
  run, after fixing those eight: one more, a follow-on break in a fourth
  file caused by narrowing a type to fix one of the original eight,
  demonstrating directly why a fix needs a rebuild to confirm it, not
  just a read-through. Third run: fully clean, `Compiled successfully`,
  `Finished TypeScript`, all 54 routes listed with no errors. This is the
  first time this whole project has had a complete, real, passing
  production build confirmed against a real database. Nothing guarantees
  a future change won't introduce a new one, running `next build`
  occasionally after future changes, not just `npm run lint`, remains
  worth doing from a machine that can, this project now has direct proof
  twice over (Module 18, Module 31) that it catches real bugs lint alone
  does not.
  **Module 32 addendum**: `npx tsc --noEmit` (as opposed to `next build`,
  which still cannot run here) does run successfully inside this
  sandbox, the blocker is specifically the build step's Google Fonts
  fetch, not TypeScript itself. It is not a substitute for a real `next
  build`, most of its output here is noise from this sandbox's own stale
  generated Prisma Client (implicit-`any` parameters and missing exports
  like `VehicleType`/`InvestorProfile`, spread across many files already
  confirmed clean by a real build), so its output has to be read
  selectively rather than trusted wholesale. But it did catch one real,
  self-inflicted bug this module: adding `REPORTS_VIEW` to `PERMISSIONS`
  without adding a matching entry to `prisma/seed.ts`'s
  `PERMISSION_DESCRIPTIONS` map, a plain "this object doesn't satisfy its
  own declared type" error with no dependency on Prisma's generated
  types at all, so a real one, not sandbox noise, confirmed independently
  when the project owner's own `npx prisma db seed` run failed on it for
  real (`PrismaClientKnownRequestError` on
  `prisma.permission.findUniqueOrThrow`, `reports.view` had never been
  inserted). Worth running `npx tsc --noEmit` in this sandbox after any
  change that adds a new key to a `Record<SomeUnionType, ...>`-typed
  object specifically, this exact bug shape has now happened once for
  real, and this check catches it without needing a round trip to the
  project owner's machine first. **Confirmed clean**: the reseed then
  succeeded for real, and a real `next build` from the project owner's
  machine came back fully clean too, 55 routes (one more than Module
  31's 54, `/admin/reports`), no errors, which also confirms the
  implicit-`any`/missing-export noise this sandbox's `tsc --noEmit`
  reported against `lib/data/reports.ts` really was this sandbox's own
  stale Prisma Client, not a real defect, exactly as suspected at the
  time.
  **Module 48 addendum**: the project owner ran `npx prisma generate`
  then `npm run build` again, confirming `prisma generate` now works
  cleanly from their machine (this sandbox's block on
  `binaries.prisma.sh` really is sandbox-only, reconfirmed a second
  time). The build itself caught one real type error this round, see
  "Real `next build` type error, fixed (Module 48)" above, a genuine
  missing `?.` on a nullable `Driver.user` relation, not stale-Prisma
  noise. Same lesson as Module 31/32 again, a third time now: this
  sandbox's own checks (`eslint`, `tsc --noEmit`, `vitest`) are real
  and worth running on every change, but they are not a substitute for
  an actual `next build`, which keeps finding a different real bug
  each time someone actually runs one. Not yet reconfirmed with a
  second, clean `next build` after this fix, that confirmation has to
  come from the project owner's own next run, the same way it did for
  Module 31's third run and Module 32's reseed-and-rebuild.
  **Module 49 addendum: confirmed.** The project owner ran `npm run
  build` again and it came back fully clean, `Compiled successfully`,
  78 routes, no errors, closing that loop the same way Module 31's
  third run and Module 32's reseed-and-rebuild did before it. That same
  terminal session then ran `npm run dev` and hit a real, unrelated
  problem (missing database columns, not a build or type problem at
  all), see "Migration deploy step owed, and a researched console
  warning (Module 49)" below, so this specific gap, whether real `next
  build` output can be trusted, stays closed even though a different
  gap opened right after it.
- **Resolved**: the Module 14 wallet migration
  (`prisma/migrations/20260831142116_add_wallet_system`) and the Module 23
  withdrawal-cancel enum migration
  (`prisma/migrations/20260901120000_add_wallet_withdrawal_cancelled`)
  could not be applied or generated from this sandbox, `npx prisma
  migrate dev`/`generate` need to reach `binaries.prisma.sh` to download
  Prisma's engine binaries, which is blocked here. Both were written and
  reviewed by hand instead (see their own README entries), and are now
  confirmed applied for real against the project's actual Supabase
  database: `npx prisma migrate status`, run from the project owner's own
  Windows machine, reported "4 migrations found in prisma/migrations,
  Database schema is up to date!". This sandbox still cannot reach that
  database itself, so this is a real, pasted confirmation from the one
  machine that can, not a self-report anymore.
  Module 50 addendum, resolved for real: that "4 migrations" count is
  now stale twice over. `npx prisma migrate deploy`, run from the
  project owner's own machine, reported "7 migrations found in
  prisma/migrations," not 5, this sandbox's own copy of
  `prisma/migrations/` was also missing
  `20260901140414_add_password_and_payout_preference`, a migration
  already applied on the real database but never present in this
  sandbox's working copy of the repo. See "Migration deploy confirmed,
  and a missing migration file recovered (Module 50)" above for the
  full account; short version: the BVN/NIN migration applied cleanly,
  the missing file was found and restored, and this sandbox's own
  migrations folder cannot be assumed to be the complete, authoritative
  history any more than its Prisma Client can
  be assumed to be up to date, when in doubt, a real `migrate status`
  or `migrate deploy` count from the project owner's machine is the
  source of truth, the same lesson Module 31/32/48 already established
  for `next build` output.
  **Module 59 addendum, not yet resolved:** one more hand-written
  migration is owed the same way,
  `prisma/migrations/20260929120000_add_agent_driver_kyc_and_manual_payments`
  (see "Staff-facing agent/driver admin tools" above for what it adds).
  Unlike the migrations above, this one has not yet been confirmed
  applied against the real database, run `npx prisma migrate deploy`
  then `npx prisma generate` from the project owner's own machine and
  update this note once it has, the same way Module 50 closed the loop
  on the ones before it.
- The Module 19 automated test suite (`npm test`) covers pure functions
  directly and money-sensitive business logic against a mocked Prisma
  client, but is not a substitute for real integration testing. A mocked
  client can't catch a wrong column name, a bad migration, or a query
  that's syntactically valid but wrong against the real schema, only a
  real `next build` plus manual testing against a real database (see
  "Testing against a local Postgres database" in the README) can do that,
  and per the bullet above, that database can't be reached from this
  sandbox at all.
- A driver with no linked User account gets their deposit alert SMS
  through `sendUntrackedSms()`, not `sendNotification()`, since there is
  no User to attach a `Notification` row to. That message will never
  show up in any notification history or admin screen the way every
  other one in this app does, see "Notifications" above. Since Module 22
  this only applies to a driver created before Module 22, or created
  directly against the database (the seed script); every driver created
  through the app now gets a real User account at creation and so goes
  through the normal tracked path instead.
- The `db:migrate`/`db:migrate:dev`/`db:generate`/`db:studio` scripts
  added to `package.json` in Module 22 are convenience wrappers around
  the same `prisma` CLI, they do not change the gap two bullets up: this
  sandbox still cannot reach `binaries.prisma.sh` to download a working
  query engine, so none of these scripts, or the equivalent bare `npx
  prisma ...` commands, can actually run here either. They exist for
  running on a normal development machine, primarily to fix a real
  Windows issue: a bare `prisma ...` command (no `npx`, no `npm run`)
  fails there with `CommandNotFoundException`, since `prisma` is a
  devDependency, not installed globally.
- A USSD balance check (a driver dialing a `*XXX#` code from a feature
  phone to check what's landed in their collection account) came up
  alongside the Module 21 driver-DVA work and was deliberately not
  built. Termii, already integrated for SMS, does not offer USSD as a
  product as far as could be confirmed, a real short code has to be
  leased from a telecom aggregator, a business/registration step with
  real cost and lead time, not a code change. Nothing here is stubbed
  out for it, nothing needs to be, whichever provider is eventually
  chosen will bring its own request/response shape.
- Resolved in Module 24: there was no driver-facing portal or dashboard
  anywhere in this app, Module 22 made every driver's Supabase Auth
  account real and trackable but left nothing for it to sign into. See
  "Driver portal" above.
- **Bug found and fixed in Module 24, generalized round nine.** The
  "Staff / Agent" tab on `/sign-in` (later "Staff / Agent / Driver")
  always sent a successful, non-Admin sign-in to `/admin/dashboard`,
  regardless of whether the account was actually staff, an agent, or
  (once Module 24 gave them somewhere to go) a driver. An agent or
  driver signing in through that tab would have landed on the operations
  console instead of their own portal, this went unnoticed because the
  only accounts anyone had actually tried signing in with through it
  were staff and admin.demo. Fixed at the time with
  `resolveStaffPortalDestination` checking the signed-in account's
  actual profile and routing accordingly instead of assuming, but the
  "Investor" tab right next to it kept the exact same bug in miniature:
  it just pushed straight to `/investor/dashboard` with zero check,
  so a staff, agent, or driver account signing in on the *default* tab
  still landed on a "no investor profile" message. Round nine, direct
  user testing: removed both tabs entirely and renamed the function to
  `resolvePortalDestination`, now checking staff, agent, driver, *and*
  investor in one place, whatever credentials were actually typed. See
  the round nine entry above for the full write-up, including the
  mobile side of the same fix.
- Resolved in Module 25: there was no in-app way to create the very
  first Admin account on a brand new deployment, every creation flow
  needed a permission only an Admin could grant, and no Admin could
  exist yet to grant it. The only path was a manual database or Supabase
  dashboard edit. See "`/setup`" above and `bootstrapFirstAdmin` in
  `lib/actions/auth.ts`.
- **Three bugs found and fixed in Module 25, all by trying the real
  thing, not by reasoning about the code**: first, `/setup` itself
  called `prisma.staff.count()`, which doesn't exist (the model is
  `StaffProfile`), throwing immediately on the project owner's first
  real visit to the page. Second, and unrelated to this module's own new
  code, `retryAgentCollectionAccount` in `lib/actions/staff.ts` (the
  "Create" button next to an agent with no collection account on
  `/admin/settings/staff`) threw its real Paystack failure message into
  a crash instead of showing it, likely never exercised for real before
  since it needs an actually configured `PAYSTACK_SECRET_KEY` to reach
  that path. Third, also pre-existing: every portal sidebar's
  highlighted item was frozen on Dashboard forever, `active: true` was a
  hardcoded static value in each layout.tsx's nav array, never
  recomputed against the actual current page, and `AppShell` used plain
  `<a>` tags instead of `next/link`'s `<Link>`. Fixed with a new
  `SidebarNav` Client Component (`components/layout/sidebar-nav.tsx`)
  that computes the active item from `usePathname()` on every render.
  All three fixed, see the Module 25 README entry for the full detail on
  each.
- Module 26 adds two columns (`User.mustChangePassword`,
  `InvestorProfile.defaultPayoutDestination`) to the schema. Unlike every
  earlier migration in this project, this one was **not** hand-written in
  the sandbox, the project owner's own machine can now reach
  `binaries.prisma.sh` (confirmed via a real `npx prisma migrate status`
  in Module 25), so generating it correctly there with `npx prisma
  migrate dev --name add_password_and_payout_preference` is safer than
  another hand-authored one. Needs that command run once, `npx prisma
  generate` after, before either field actually exists on a real
  database.
- Module 26 added a sidebar link to `/admin/payments/reconciliation`,
  believing (from code inspection, not from actually clicking through it)
  that the page had existed and worked since Module 15, just unreachable.
  **Correction, Module 27**: it was not actually working. Both of its
  Server Actions threw on every failure path while bound to plain forms,
  the exact bug shape flagged as likely still lurking elsewhere in the
  bullet below, and having no sidebar link at all until Module 26 meant
  nobody had ever actually exercised it end to end before it was reported
  broken. Fixed in Module 27 (see "Payments" above), and the sidebar item
  itself removed again, `/admin/payments/batches`'s own "Reconciliation"
  button is the only way in now, matching how it was reached before
  Module 26. Lesson for future modules: "the code looks right" is not the
  same claim as "this was clicked and confirmed working," say which one
  is actually true.
- **Resolved in Module 43.** The throw-inside-a-plain-form-action bug
  shape below, found and fixed six times reactively across Modules 25-27
  (`bootstrapFirstAdmin`, `retryAgentCollectionAccount`,
  `updatePayoutDetails`, `matchProviderTransaction`,
  `dismissProviderTransaction`, `createPaymentBatch`), finally got the
  dedicated sweep this entry had been flagging as overdue since Module
  26. See "Server Actions and form safety (Module 43)" below for the
  full write-up: every remaining unsafe instance across 13
  `lib/actions/*.ts` files (32 functions in total) converted to a
  `{ error?: string }` return, paired with a new shared
  `components/ui/action-form.tsx` wrapper so the fix is one reusable
  component rather than 32 bespoke ones. The original bug-report
  history is kept below for context.
- The same throw-inside-a-plain-form-action bug shape, found and fixed
  six times now across three modules: `bootstrapFirstAdmin` and
  `retryAgentCollectionAccount` (Module 25), `updatePayoutDetails`
  (Module 26), and `matchProviderTransaction`, `dismissProviderTransaction`,
  and `createPaymentBatch` (Module 27, see "Payments" above and the
  reconciliation correction above this bullet). The Module 26 entry
  predicted more would turn up "that haven't been exercised for real
  yet," and that is exactly what reconciliation was, unreachable until
  Module 26 added a sidebar link, broken the entire time underneath. Six
  instances across every module that has touched a form-bound action so
  far is no longer a coincidence worth debating, it is this codebase's
  single most consistent bug shape. A dedicated pass, grepping every
  `"use server"` file for a bare `throw` reachable from a plain
  `<form action={fn}>` rather than one wrapped in a Client Component that
  can catch and display it, was done in Module 43, see above.
- Staff can no longer override an individual investor's payout
  destination per batch item, Module 26 made it the investor's own
  standing choice instead, see "Account security" and "Payments" above
  for the reasoning. If a real one-off exception is ever needed (an
  investor wants one specific payout sent to their bank despite their
  wallet default, say), the only path today is the investor changing
  their own preference on `/investor/payout-details` before the batch is
  created, and changing it back after. No per-batch-item override exists.
- Resolved in Module 27: a real, database-level bug in `createDriver`
  (`lib/actions/drivers.ts`), found while writing `updateDriver` right
  next to it and cross-checking every Prisma call in the file against the
  real schema (the same discipline that caught the `prisma.staff` versus
  `prisma.staffProfile` mistake in Module 25). The nested
  `driver: { create: { phone, agentId } } }` never set `fullName`, even
  though `Driver.fullName` is a required column with no default. Every
  call to `createDriver` would have failed outright at the database
  level with a missing-required-field error. Fixed by adding `fullName`
  to that nested create.
- Resolved in Module 27: investor, driver, and staff/agent records had no
  edit screen at all before this, only creation. Each list page now links
  to a detail/edit page (`/admin/investors/[id]`, `/admin/drivers/[id]`,
  `/admin/settings/staff/[id]`), see "Every route, by portal" above.
  Account type (staff versus agent) is deliberately not editable there,
  converting one to the other would need its own dedicated flow to decide
  what happens to an agent's collection account or a staff member's
  approval history.
- Resolved in Module 27: the payout-destination control on
  `/admin/investors/new` (and now the investor edit page and
  `/investor/payout-details`) was a `<select>` dropdown, the original ask
  was explicit about wanting "a check box or a tick." All three now use
  an actual checkbox.
- **New in Module 27, deliberately left as is**: once a contract hits
  `TARGET_ACHIEVED` early (before its full term has elapsed), the
  `PaymentScheduleEntry` rows for the rest of its original term are never
  relabeled, they stay in whatever status they were already in (typically
  `UPCOMING`). They can never actually be paid into (the `contract:
  {status: "ACTIVE"}` filter added to `getDueScheduleEntriesForBatch` this
  same module, see "Payments" above, makes sure of that) and never appear
  to staff anywhere, so this has no functional effect, it is purely about
  how those rows would read to someone querying the database directly.
  Giving them a real terminal status would need a new `ScheduleEntryStatus`
  enum value (the existing ones don't fit: `DEFERRED` reads as "postponed
  to later," not "permanently moot") and another migration, not
  worth it for a display-only concern. Revisit if this ever actually
  confuses someone reading the raw data.
- **Open in Module 28, re-investigated without resolution in Module 33,
  resolved later in Module 33 once the browser's own "Component stack"
  came in.** A React dev-mode console warning, "Each child in a list
  should have a unique key prop... Check the render method of
  `LinkComponent`" (`LinkComponent` is `next/link`'s own internal name,
  not app code). Both prior passes checked every `.map()` paired with a
  `Link` or `TableRow` across all four portals by hand, all correctly
  keyed off a database id or a unique static href, `react/jsx-key`
  ESLint clean, and this sandbox couldn't boot `next dev` far enough to
  reproduce it live (the first real page compile needs Google Fonts,
  blocked here the same way `next build` is). Neither pass had the one
  thing that actually pinpoints this class of warning: the browser's
  own error overlay "Component stack." Once the project owner pasted
  that, it named `layout.tsx:128` and `layout.tsx:165`, i.e.
  `app/admin/layout.tsx`'s `navGroups` array and `AdminLayout`'s own
  closing brace. Real root cause: `navGroups` is a plain array literal
  built inside a Server Component (`AdminLayout`) and passed as a prop
  across the server/client boundary to `SidebarNav` (a Client
  Component), and each `NavItem.icon` field holds a raw JSX element
  (an inline `<svg>` or `<KekeIcon>`) at an arbitrary position inside
  that data, not as an actual children list. Next's Flight serializer
  still has to ship those icon elements to the client as part of the
  payload, and the client's reconciler (visibly triggered by Fast
  Refresh here, "[HMR] connected" sits directly above the warning in
  the console) walks that array the same way it walks a real children
  list, so an icon element sitting at an array position with no `key`
  of its own reads as an unkeyed list child, even though `SidebarNav`'s
  own `.map()` (which keys every rendered `<Link>` off `item.href`)
  was never actually missing a key, this lived one level up in the
  data the Client Component receives. Not admin-only: `app/agent/
  layout.tsx`, `app/driver/layout.tsx`, and `app/investor/layout.tsx`
  all build `navGroups` the same way, so all four portals carried the
  same latent issue, only the two admin pages the project owner
  happened to load had actually surfaced it. Fixed by giving every
  inline icon element in all four `layout.tsx` files its own explicit
  `key` (a slug of that item's own `label`, e.g. `key="fleet-icon"`),
  26 icons total across the four portals.
- Resolved in Module 28: `/admin/kyc`, `/admin/payments/batches`, and
  `/admin/settings/roles` styled their list rows with `cursor-pointer`
  but only a small `Link` inside one cell was actually clickable, the
  rest of each row did nothing. New `components/ui/clickable-row.tsx`
  wraps `TableRow` in a Client Component that navigates on click anywhere
  in the row. Both the KYC review flow and the payment batch approval
  flow it made hard to reach were already fully built and working
  (per-document and overall KYC decisions on `/admin/kyc/[investorId]`,
  Approve & Pay/Reject on `/admin/payments/batches/[id]`), this was a
  discoverability bug, not a missing-feature one.
- Resolved in Module 28: the status pills, search box, "Filters", and
  "Location" control on `/admin/fleet` were entirely decorative, none of
  them had any state or handler behind them. New
  `app/admin/fleet/fleet-browser.tsx` makes all of them real, filtering
  the already-fetched fleet list client side by status, vehicle type,
  and location, plus a real text search.
- Resolved in Module 28: `/admin/fleet/new`'s asset tag field was a bare
  required text input with no default, now suggests the next number
  under the picked vehicle type's prefix (`getNextAssetTagsByType` in
  `lib/data/fleet.ts`), editable if the admin wants something else.
- Resolved in Module 28: no submit button anywhere in the app gave any
  visual feedback while its request was in flight, beyond the handful
  that already tracked their own `isSubmitting` state and swapped their
  label text. `Button` (`components/ui/button.tsx`) now takes a
  `loading` prop that shows a spinner and disables the button; new
  `components/ui/submit-button.tsx` wraps `useFormStatus()` for the
  roughly 20 plain Server Component forms that had no pending state of
  their own, and the forms that already tracked `isSubmitting` now pass
  it through to `Button` too. One exception left alone on purpose: the
  audit log's "Filter" button is a plain GET-navigation form, not a
  server action, so there is no pending state for `useFormStatus` to
  ever report.
- Resolved in Module 28: there was no way for staff to enter or correct
  an investor's bank account from the admin side at all, only the
  investor themselves could, from `/investor/payout-details`. New
  `updateInvestorBankDetails` (`lib/actions/investors.ts`) and a second
  card on `/admin/investors/[id]`, gated on `investors.manage`, same
  Paystack-resolve-before-save flow as the investor's own.
- **Real bug, fixed in Module 29**: `/admin/kyc/[investorId]` threw
  `PrismaClientValidationError` on every load where at least one document
  had already been reviewed. `getInvestorKycDetail` (`lib/data/kyc.ts`)
  used `include: { reviewedBy: { include: { user: true } } }` on
  `KycDocument` as if `reviewedBy` were a real Prisma relation, it never
  was, `KycDocument.reviewedById` is a plain `String?` column, unlike the
  identical reviewer pattern on `WalletWithdrawal`/`OwnershipTransfer`,
  which both have a real `@relation`. Same "never exercised for real"
  shape as reconciliation in Module 27, this page had apparently never
  actually been opened for an already-reviewed document before. Fixed
  without touching the schema or needing a migration: reviewer names are
  now resolved with a second `staffProfile.findMany` query instead of a
  Prisma `include`. A proper `@relation` could still be added later to
  match the other two models, that would need a migration to add the
  foreign key constraint, worth doing the next time a schema change is
  already in flight rather than as its own one-line migration.
- Resolved in Module 29: the investors list gave no visual signal about
  which investors were missing bank details, and (the same
  "cursor-pointer but not actually clickable" issue fixed elsewhere in
  Module 28, missed on this one list) its rows weren't reliably
  clickable either. `/admin/investors` now has a "Bank account" column
  and uses `ClickableRow` like the other list pages. Bank details live on
  the investor's own record (`/admin/investors/[id]`) regardless of KYC
  status, entering or updating one has no dependency on where that
  investor's KYC review stands either way.
- **Resolved, Module 33**: the React key console warning first reported
  alongside Module 28's other items, reported again with the same trace
  ("at svg (`<anonymous>`:null:null)") and no file or line in it at the
  time. A second, more targeted search back then (every `.map()` that
  renders a raw `<svg>` element) also found nothing, since the real
  cause was not a `.map()` at all. Same underlying bug as the
  `LinkComponent` warning entry above, once the browser's actual
  "Component stack" finally came in it pointed at the same
  `navGroups`-with-unkeyed-icon-elements pattern in the four portal
  `layout.tsx` files, fixed the same way, see that entry for the full
  explanation.

## Performance notes

The most impactful fix so far: `getCurrentUser()` (`lib/auth/current-
user.ts`) is wrapped in React's `cache()`. Before that, every portal
layout and every page under it called it independently, each call doing
a Supabase Auth round trip plus two Postgres queries, so a single page
load was paying for that twice. `cache()` dedupes calls within one
request; it does not cache across requests, so a role change or a new
session is still picked up on the very next navigation.

If the app still feels slow after that fix, the next places to look, in
order: (1) any page doing more sequential `await`s than it needs to,
independent queries should run through `Promise.all` the way
`getAdminDashboardData` in `lib/data/admin.ts` already does, not
one-after-another; (2) the physical distance between wherever the app is
hosted and the Supabase project's region, every additional query is
another full round trip if they're on different continents; (3) missing
database indexes on columns used in a `where` or `orderBy` on a table
that's grown large, Prisma does not add these automatically beyond what
`@unique`/`@id` already imply. None of this has been profiled yet on real
production data, this is a prioritized list of what to check, not a
diagnosis of a specific bottleneck.

Separately, every data-heavy route now has a matching `loading.tsx`
(shimmering skeleton placeholders, see `components/skeletons.tsx` and the
`.skeleton` animation in `app/globals.css`). This does not make the
database faster, the physical round trip still takes exactly as long, but
it closes the blank-screen gap while that round trip is in flight, which
is most of why a slow connection reads as "broken" rather than "still
working." A layout's own `getCurrentUser()` call still has to resolve
before any of this shows, since Next.js can't render a route segment's
`loading.tsx` until its parent layout has rendered, that's an
architectural floor, not something a skeleton file can route around.

## Dashboard charts

All three role dashboards now show a real chart, added incrementally:
admin's "realized payments" chart and "fleet by status" donut existed
from early on, investor's "payouts realized" and agent's "remittances
collected" trend charts were added in Module 20.

The line-and-area trend chart is one shared component,
`components/charts/area-trend-chart.tsx` (`AreaTrendChart`), not three
copies. It takes plain `weeks`/`amounts` arrays, a `formatAmount`
function, an empty-state message, and a `gradientId` that must be unique
per chart on the page (SVG `<defs>` ids are global to the document). The
week-bucketing behind all three charts is also shared,
`buildWeeklyTrend()`/`weeksAgoStart()` in `lib/data/chart-helpers.ts`,
called from `lib/data/admin.ts`, `lib/data/investor.ts`, and
`lib/data/agent.ts` against the same `PaymentTransaction` table, scoped
by nothing (admin, system-wide), `investorId`, or `agentId`
respectively. The "fleet by status" donut on `/admin/dashboard` has no
shared component yet, it is the only donut in the app so far, its math
still lives inline in `app/admin/dashboard/page.tsx`. Module 32's
`/admin/reports` reuses the same `AreaTrendChart` component for its two
daily charts (inflow, outflow), day labels instead of week labels, but
its own daily-bucketing helpers, `startOfDay()`/`dayLabel()` in
`lib/utils.ts`, live next to (not inside) `chart-helpers.ts`, since a
day bucket and a week bucket need different key math and this app has
no single caller that needs both.

That donut had a real bug, found and fixed in Module 20: its ring
segments covered active, maintenance, unassigned, and pending vehicles,
but the center total (and the `total` the arc lengths are computed
against) is every vehicle including retired ones. Any fleet with a
retired vehicle drew a ring whose colored arcs summed to less than a
full circle, a visible gap, while the center number silently counted
retired vehicles anyway. Fixed by giving retired vehicles their own
segment and legend row.

## Visual design

`Card` (`components/ui/card.tsx`) carries a soft, warm-toned elevation
shadow (`--shadow-card` in `app/globals.css`, charcoal-based rather than
plain black, to match the brand palette rather than looking like a
generic UI kit) by default now, this is what took every screen from flat
bordered boxes to something with actual depth. `--shadow-card-hover` is
available for anything that's clickable and should lift slightly, applied
today on fleet cards. Changing the elevation app-wide means editing those
two CSS variables, not hunting through every page.

`KekeIcon`/`KekeWatermark` (`components/design-system/keke-icon.tsx`) stay
the app's fixed brand mark regardless of vehicle type, they appear in the
sidebar and the sign in/KYC hero panels the same way whether the app is
showing a keke, a car, or a bike that day. Telling one vehicle's type from
another in the fleet list and detail page uses a separate, generic
`VehicleTypeIcon` (`components/design-system/vehicle-icons.tsx`), which
picks between `KekeIcon` and its two new same-style siblings, `CarIcon`
and `BikeIcon`, based on the vehicle's `type`.

**Detail page layout (Module 33 fix, extended Module 34)**: several
detail/settings pages stack every card in one column capped at
`max-w-[560px]`, on a screen wider than that the rest of the row sits
empty and the page scrolls sooner than it needs to. Fixed for
`/admin/investors/[id]` in Module 33 (edit form and account access on
the left, bank account on the right), and for three more pages sharing
the identical shape in Module 34: `/admin/drivers/[id]`,
`/admin/settings/staff/[id]`, and `/investor/payout-details`, all now
`grid grid-cols-1 gap-5 px-8 py-6 lg:grid-cols-2 lg:items-start` with
the `max-w` caps removed, same fix, four times over.
`/admin/settings/contract-terms` (reported directly this round) needed
a variant: its two vehicle-type cards live inside a `<form>` alongside
a "Save all" button that has to stay full width below them, so only
the card pair itself was wrapped in
`grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start`, the form and
submit row stayed a plain column. `/admin/transfers/[id]` and
`/admin/kyc/[investorId]` were surveyed and deliberately left alone,
their cards are a hero progress banner, a document table, and action
panels, not interchangeable same-shaped boxes, a forced grid there
looked likely to make the page read worse, not better, revisit only
with a specific layout in mind, not just "give it the same grid."

**Click feedback (Module 34)**: `components/ui/button.tsx` now carries
`active:scale-[0.97]` on every `Button` (and, through it,
`SubmitButton`), a pure CSS `:active` pseudo-class that fires the
instant a mouse or tap goes down, before any JavaScript runs. This is
deliberately separate from `Button`'s existing `loading` prop /
`SubmitButton`'s `useFormStatus()` pending state (Module 25/28), which
still only appears once a Server Action's request round-trips, the
press animation closes the gap before that, the moment between the
click and the network request even starting. The transition list is
spelled out explicitly,
`transition-[color,background-color,border-color,box-shadow,transform]`,
rather than adding a second `transition-*` Tailwind utility next to
the existing one, two of those utilities both set the same underlying
`transition-property` CSS value and the second would silently replace
the first rather than combine with it.

**Print mode (Module 33)**: `print:hidden` on the sidebar
(`components/layout/app-shell.tsx`) and on `ReportsTabs`/filter forms
is how the partner statement page's "Print / Save as PDF" button
produces a clean document, Tailwind's `print:` variant, not a separate
stylesheet. Any future page that wants a printable view follows the
same pattern: mark the chrome around the content `print:hidden` rather
than building a separate print-only layout.

## Environment variables

The authoritative list, with comments explaining each one, is
`.env.example`. Whenever a new integration is added (Dojah was the most
recent, Module 46), that file gets the new variables in the same
change, not as a follow up.
