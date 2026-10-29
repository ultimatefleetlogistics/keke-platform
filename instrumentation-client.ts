import * as Sentry from "@sentry/nextjs";

/**
 * Browser side Sentry init, runs once when the app boots in a visitor's
 * browser. Same DSN and `enabled` guard as the server side, see
 * instrumentation.ts, off by default until NEXT_PUBLIC_SENTRY_DSN is set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1,
});

// Required by the SDK so App Router navigations are tracked, otherwise it
// warns on every build that this export is missing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
