import * as Sentry from "@sentry/nextjs";

/**
 * Registers Sentry once per server process, for whichever runtime this
 * process actually is. This replaces the older sentry.server.config.ts
 * and sentry.edge.config.ts files, current versions of the SDK want
 * Sentry.init called from inside this Next.js instrumentation hook
 * instead. See instrumentation-client.ts for the browser side.
 *
 * NEXT_PUBLIC_SENTRY_DSN has sat in .env.example since Module 1 with
 * nothing reading it, this is what finally does. `enabled` is explicit
 * rather than relying on an empty DSN quietly no-opping, so it is obvious
 * from this file alone that Sentry is off until a real DSN is set, the
 * same pattern every other optional integration in this app follows
 * (Resend, Termii, both check their own env vars and degrade rather than
 * assuming they're configured).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      environment: process.env.NODE_ENV,
      // This app's traffic is small (staff and a few hundred investors at
      // most, not a consumer app), tracing every request is affordable and
      // most useful exactly where it matters, the payment and webhook
      // paths. Lower this if usage ever grows enough that Sentry's quota
      // becomes a real cost.
      tracesSampleRate: 1,
    });
  }
}

/**
 * Catches errors from nested React Server Components that render below
 * where any error.tsx boundary sits, required by the SDK for full server
 * side coverage, see
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#errors-from-nested-react-server-components
 */
export const onRequestError = Sentry.captureRequestError;
