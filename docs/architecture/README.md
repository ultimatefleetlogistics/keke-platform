# Architecture reference

This is the written record of the decisions made during planning, kept in
the repository so it survives independent of any chat history.

**Looking for what's actually built right now, not why it was designed
this way?** Read `docs/architecture/CURRENT_STATE.md` first, it's the
up to date snapshot. This file is the "why," kept deliberately stable;
that one is the "what, as of today," and gets updated every time a module
ships.

## Stack

Next.js (TypeScript, App Router) deployed as one app to Vercel. Route
Handlers and Server Actions are the backend, there is no separate backend
service. PostgreSQL via Supabase, accessed through Prisma. Supabase Auth
for sign in. Supabase Storage (private buckets) for KYC and other
documents. Paystack for payments. Resend for email. Sentry for error
tracking.

## Why one Next.js app instead of a separate frontend and backend

Next.js Route Handlers and Server Actions run as serverless functions
inside the same deployment as the pages. One deployment, one URL, no CORS
between frontend and backend, and the two share TypeScript types. Anything
that would need to run longer than a request allows (a scheduled report,
for example) uses Vercel Cron rather than a long-running server process.

## Prisma and Supabase

Two connection strings: `DATABASE_URL` is the pooled Supavisor connection
the app uses at runtime (serverless functions open and close connections
constantly, pooling prevents that from overwhelming Postgres).
`DIRECT_URL` is the direct connection Prisma's CLI (`migrate`, `generate`)
uses, since pooling can interfere with migration locking. Both are set in
`.env.local`, see `.env.example`.

## Payments

Two directions, both automated through Paystack:

**Collections (agent or driver to the business).** Each agent and driver
gets a Paystack Dedicated Virtual Account (`lib/payments/paystack-
provider.ts`, `createCollectionAccount`). A transfer into that account
fires a `charge.success` webhook identifying the payer by Paystack
customer code. `lib/payments/webhook-handler.ts` records the payment and,
as a starting allocation, applies it to that collector's vehicle's
earliest unpaid schedule entry. Staff can re-allocate from the admin
console if that default guess is wrong.

**Payouts (business to investors).** A `PaymentBatch` groups the week's
investor payouts. Creating a batch and approving it are two different
permissions (`payments.batch.create`, `payments.batch.approve`), held by
different people, enforced in `lib/rbac`. Once approved, each
`PaymentBatchItem` becomes a Paystack Transfer (`initiateTransfer`). A
`transfer.success` or `transfer.failed` webhook updates that item and, on
success, records the outbound `PaymentTransaction`.

**One-time account setup, not done by the app itself:** Paystack requires
an OTP for every transfer by default. `requestDisableTransferOtp` and
`finalizeDisableTransferOtp` in `paystack-provider.ts` are the two calls
needed to turn that off so payouts can run without a manual code each
time. This trades Paystack's OTP protection for the in-app maker-checker
approval as the compensating control, do this deliberately, not by
accident.

## Contract terms are data

`InvestmentContract` stores `principalAmount`, `installmentAmount`,
`paymentFrequency`, `termMonths`, and `targetPayoutAmount` as editable
fields on each contract, never as constants in code. This is what let the
same contract form serve keke, car, and bike contracts without a
per-vehicle-type branch anywhere in the money logic, only the values
pre-filling the form differ, see `lib/vehicle-types.ts`. A vehicle is
marked target achieved (and the ownership transfer workflow, verification
then staff approval, never automatic, is triggered) once the cumulative
amount paid to that investor reaches `targetPayoutAmount`, regardless of
how much of `termMonths` has elapsed.

## Webhook idempotency

`ProviderTransaction.providerRef` has a unique constraint. Every webhook
handler tries to insert a row keyed by Paystack's own event reference
before doing anything else; a duplicate delivery hits that constraint and
is treated as already handled. Nothing about a payment is interpreted
until that row exists.

## RBAC

Roles and permissions are database rows (`Role`, `Permission`,
`RolePermission`, `RoleAssignment`), editable from an admin settings
screen, not a fixed list in code. `lib/rbac/permissions.ts` defines the
fixed vocabulary of permission keys the app understands; which roles have
which permissions is data, seeded once from `DEFAULT_ROLE_SEED` and then
owned by the database.

## BVN and NIN

Collected during KYC onboarding and stored for manual staff review in
this phase. Paystack's BVN verification currently costs about ₦10 per
call with 10 free calls a month, cheap enough that turning on automated
verification later is a small addition, not a redesign, so it was
deliberately left out of phase one.

## Notifications

Investors are notified over email and/or SMS at three points: a payout
landing in their account, an ownership transfer completing, and their KYC
status changing. Both channels sit behind their own interface
(`EmailProvider`/`SmsProvider` in `lib/notifications/provider.ts`), the
same shape as `PaymentProvider` for Paystack, so the concrete vendor
(Resend for email, Termii for SMS) can change later without touching any
of the three call sites. Every attempt is recorded as a `Notification`
row and the send itself never throws, a failed text message must never
make an otherwise successful payout look like it failed. See
`docs/architecture/CURRENT_STATE.md` for the full picture, including
which environment variables each provider needs.

## What is intentionally not built yet

See `docs/architecture/CURRENT_STATE.md`, "Known gaps," for the current,
maintained list. It is not duplicated here because a list of what's
missing goes stale the moment the next module ships, and this file is
meant to stay stable.
