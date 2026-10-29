import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * "/" was missing from this list until 2026-10-22: proxy() below redirects
 * any signed-out visit to a non-public path straight to /sign-in, so the
 * new public homepage (app/page.tsx) was being redirected away before it
 * ever rendered — every signed-out visitor saw /sign-in?redirectedFrom=%2F
 * instead of the homepage. "/" has to be public: it's the one route meant
 * to render for anyone, signed in or not (resolvePortalDestination() inside
 * app/page.tsx itself still sends a signed-in visitor on to their
 * dashboard, so this doesn't expose anything — it just lets the page run).
 *
 * "/services" (same day, later): the exact same bug, one route later —
 * app/services/page.tsx is a second public marketing page (each
 * ServiceCard's "Full service details" link, and the homepage's "View All
 * Services" link, both point at it), but it wasn't in this list either, so
 * every signed-out visitor clicking either link got bounced to /sign-in
 * instead of the services page. Public for the same reason "/" is: nothing
 * on it needs a signed-in session.
 *
 * "/about" (2026-10-23): added proactively, before shipping — the same
 * public marketing page pattern as "/services" above, so it goes in this
 * list in the same change that creates the route, rather than waiting for
 * a third "clicking X does nothing" report to notice it's missing again.
 * Any future public marketing page should follow the same rule: add it
 * here in the same commit/session that adds the route.
 */
const PUBLIC_PATHS = [
  "/",
  "/about",
  "/services",
  "/sign-in",
  "/sign-up",
  "/admin-sign-in",
  "/forgot-password",
  "/reset-password",
  "/setup",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Content-Security-Policy, nonce-based, following the pattern Next.js's
 * own docs recommend for the App Router (a fresh nonce generated in
 * proxy.ts/middleware.ts on every request, read back in app/layout.tsx
 * via headers()). Round seven's security audit added the five headers in
 * next.config.ts (X-Frame-Options and friends) but explicitly left CSP
 * out, see that file's comment: this app ships one inline script (the
 * dark-mode theme-init script in app/layout.tsx) and a CSP strict enough
 * to matter blocks inline scripts unless they carry a matching nonce,
 * which a static next.config.ts headers() entry cannot generate, only
 * something that runs per request can. That's what this is.
 *
 * Every directive here reflects what this app actually loads, checked
 * directly rather than copied from a generic template:
 *  - script-src/style-src carry the nonce, 'strict-dynamic' on scripts
 *    (recommended alongside nonces, means the nonce'd scripts are
 *    trusted to load whatever they load next, without also having to
 *    nonce every dynamic import) and 'unsafe-eval' in dev only (React's
 *    dev-mode error reconstruction needs it, Next's own docs call this
 *    out, production never needs it).
 *  - style-src also needs 'unsafe-inline': nonces don't apply to inline
 *    style="" attributes at all, per the CSP spec, only to <style>
 *    elements, and this app has real dynamic ones (progress bar widths,
 *    per-row status colors, app/global-error.tsx's inline styles, which
 *    render completely outside this layout and any nonce it could
 *    supply). Style injection is a materially smaller risk than script
 *    injection, this is the accepted, documented tradeoff.
 *  - img-src allows data: for the MFA enrollment QR code (a data: URI
 *    from Supabase's own TOTP API, components/account/mfa-settings.tsx)
 *    and blob: for anything client-generated (e.g. file previews before
 *    upload).
 *  - frame-src https://www.google.com, added 2026-10-28 for the office
 *    map embedded on app/about/page.tsx (OFFICE_MAP_EMBED_URL, Google's
 *    keyless maps?...&output=embed form). With no frame-src at all this
 *    fell back to default-src 'self' and the browser silently refused
 *    to render the iframe, same in dev and in production, nothing to do
 *    with which host serves the page. Scoped to Google's own origin
 *    only, not a wildcard.
 *  - connect-src allows this app's own Supabase project
 *    (NEXT_PUBLIC_SUPABASE_URL, checked: lib/supabase/client.ts calls it
 *    directly from the browser for sign-in/sign-up/MFA, not just from
 *    the server) and *.sentry.io/*.ingest.sentry.io (Sentry's browser
 *    SDK, instrumentation-client.ts, reports errors straight from the
 *    browser to whatever ingest subdomain the project's DSN resolves
 *    to, which isn't fixed). Paystack was checked too: every Paystack
 *    call in this app (lib/payments/paystack-client.ts and friends) is
 *    server-side only, the browser never talks to Paystack directly, so
 *    nothing Paystack-related belongs here.
 *  - frame-ancestors 'none' is the CSP-native, modern-browser version of
 *    the X-Frame-Options: DENY header next.config.ts already sets, kept
 *    alongside it rather than instead of it for the older browsers that
 *    only honor X-Frame-Options.
 *  - report-uri/report-to point at app/api/csp-report/route.ts, a
 *    same-origin Route Handler that forwards every violation to Sentry
 *    (see its own comment). Robustness pass: before this, the only way
 *    anyone found out this policy had blocked something it shouldn't
 *    have was a developer manually opening the browser console on the
 *    right page, that manual step is still worth doing once after any
 *    real deploy, but production violations now surface in Sentry
 *    without anyone having to go looking. Both directives are sent
 *    together deliberately: report-uri is the older, most widely
 *    supported form (works in effectively every browser that enforces
 *    CSP at all), report-to is the current Reporting API a browser
 *    prefers when it understands both, paired with the Reporting-
 *    Endpoints response header below that actually defines where
 *    "csp-endpoint" points, a browser that only understands one of the
 *    two directives simply ignores the other.
 *
 * Nonce-based CSP requires dynamic rendering on every page it applies to
 * (a fresh nonce every request means nothing can be statically cached),
 * see app/layout.tsx's own comment for why that's already true here
 * rather than a new constraint this introduces.
 *
 * Not verified against a real running browser, this sandbox has no live
 * one attached to this app: every directive above is backed by a direct
 * grep of what this codebase actually loads rather than guessed (img-src
 * in particular: confirmed no next/image remote host and no
 * Supabase-hosted image is ever rendered as an <img>, the one Supabase
 * Storage read in this app, a KYC document's signed URL, opens as a
 * plain link in a new tab, not a same-page resource load, so 'self'
 * blob: data: is enough). The user should still do one real click-through
 * after this ships, especially sign-in/sign-up/MFA (the paths that talk
 * to Supabase straight from the browser) and the QR code step, but from
 * here on a missed case reports itself to Sentry instead of depending on
 * that click-through catching it.
 */
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const connectSrc = ["'self'", "https://*.sentry.io", "https://*.ingest.sentry.io"];
  if (supabaseUrl) connectSrc.push(supabaseUrl);
  else connectSrc.push("https://*.supabase.co");

  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    frame-src https://www.google.com;
    connect-src ${connectSrc.join(" ")};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    report-uri /api/csp-report;
    report-to csp-endpoint;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Refreshes the Supabase session on every request and redirects signed out
 * users away from anything that is not explicitly public. Route Handlers
 * and Server Actions still re-check permissions themselves, this only
 * gates page navigation.
 */
export async function proxy(request: NextRequest) {
  // 16 raw random bytes (128 bits) straight from the Web Crypto CSPRNG,
  // base64-encoded directly. Robustness pass: the previous version
  // (`Buffer.from(crypto.randomUUID()).toString("base64")`) base64-encoded
  // a UUID's 36-character hyphenated *text* form rather than raw entropy,
  // which worked (still unique and unguessable per request, a v4 UUID
  // carries 122 random bits) but wasn't the textbook construction CSP
  // guidance describes. `crypto.getRandomValues` (not Node's
  // `crypto.randomBytes`, which does not exist on the Edge Runtime this
  // file runs on) is the Web Crypto API already implicitly relied on here
  // via the global `crypto` object, `randomUUID` being one method on that
  // same interface.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  // Defines where the CSP header's "csp-endpoint" report-to group above
  // actually points, the Reporting API's own header for this, see
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints.
  // Same-origin relative path, no separate host to keep in sync.
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');

  // Every Route Handler under app/api/ authenticates itself instead of
  // relying on this cookie-based check: /api/v1/* via authenticateApiRequest's
  // bearer-token check (see lib/api/auth.ts), /api/webhooks via Paystack's
  // signature check. Neither carries a browser cookie session the way a
  // page navigation does, the mobile app in particular sends no cookies at
  // all, so gating them here on supabase.auth.getUser() would redirect an
  // unauthenticated-looking API request to /sign-in's HTML instead of
  // letting the route return its own 401/403 JSON.
  //
  // This exact bug silently broke every /api/v1 call the mobile app ever
  // made: the redirected request still "succeeded" with a 200 (the sign-in
  // page loaded fine), it just wasn't the JSON shape the caller expected,
  // so `apiFetch` (keke-mobile/src/lib/api.ts) never threw, it just quietly
  // resolved with nothing useful, and every screen that depends on it
  // looked empty rather than showing an error. Found on a real phone, not
  // caught by anything in this repo's own checks, since ESLint/tsc/vitest
  // never exercise this file against an actual bearer-token request the
  // way the mobile app does.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return response;
  }

  // Until real Supabase credentials are set in .env.local, let every route
  // through unauthenticated so the UI can be reviewed immediately. Remove
  // this guard once NEXT_PUBLIC_SUPABASE_URL is configured for real.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
