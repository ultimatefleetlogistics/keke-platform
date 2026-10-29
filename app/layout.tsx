import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";

/**
 * Self-hosted instead of `next/font/google`: both resolve to the exact
 * same font (same OFL license, same five weights this app actually uses,
 * pulled from the `@fontsource/plus-jakarta-sans` npm package, see
 * app/fonts/plus-jakarta-sans/LICENSE.txt), `next/font/local` just skips
 * the build-time fetch to Google's own font CDN. That fetch is what was
 * blocking `next build` in this sandbox (its egress policy blocks
 * fonts.googleapis.com/fonts.gstatic.com specifically, confirmed with a
 * direct curl, unrelated to anything wrong with the app), it has nothing
 * to do with runtime: `next/font/google` was already self-hosting the
 * served files (never a runtime request to Google), this only moves the
 * one-time download from "Next's build step, from Google" to "this
 * repo, already there." Output is identical either way, same
 * `--font-plus-jakarta-sans` CSS variable, same weights, same subset.
 */
const plusJakartaSans = localFont({
  variable: "--font-plus-jakarta-sans",
  src: [
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-800.woff2", weight: "800", style: "normal" },
  ],
});

/**
 * Module 50: `metadataBase` turns every relative URL in `metadata`
 * (right now, just `app/opengraph-image.tsx`) into an absolute one --
 * required for the image tag WhatsApp/Slack/iMessage actually read
 * (`og:image`/`twitter:image` must be a full URL, a relative path is
 * silently ignored and the shared link falls back to no preview at
 * all). `VERCEL_URL` is set automatically by Vercel at build/runtime
 * on every deployment (no setup needed) and always resolves, so this
 * never breaks a deploy; `NEXT_PUBLIC_SITE_URL` is there so a custom
 * domain (once one is attached, instead of the *.vercel.app one) wins
 * over it, set in the Vercel project's Environment Variables once that
 * domain exists. Falls back to localhost so `next dev`/`next build`
 * never need either var set to run locally.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Ultimate | Keke Investment & Fleet Management",
  description: "Track every vehicle, every investor, every naira, all in one place.",
};

/**
 * Module 42: sets `data-theme` on <html> before the page paints, so a
 * returning user with dark mode saved never sees a flash of the light
 * palette first. `strategy="beforeInteractive"` (next/script) is what
 * guarantees "before paint" here, a plain useEffect in a component
 * couldn't, that only runs after the first render is already on screen.
 * Order of preference: an explicit choice from ThemeToggle
 * (components/layout/theme-toggle.tsx) saved in localStorage, else the
 * OS-level `prefers-color-scheme`, else light. Wrapped in try/catch
 * since localStorage can throw in some private-browsing modes, and this
 * runs before React has mounted, an uncaught error here would be a blank
 * page, not a caught one.
 *
 * Round four fix: this script runs before React hydrates and sets
 * `data-theme` straight on the DOM node, so the attribute React sees on
 * `<html>` at hydration time never matches what the server actually sent
 * (the server has no way to know a visitor's saved theme). React flagged
 * this as a hydration mismatch, reported directly as a console error.
 * This is the documented tradeoff of every "no flash of the wrong theme"
 * script, not a real bug, `suppressHydrationWarning` on this one element
 * is the standard fix, it only silences the mismatch warning for
 * `<html>`'s own attributes, nothing inside `<body>` is affected.
 *
 * Module 49: a *different*, separate console warning was reported this
 * round, also pointing at this script: "Encountered a script tag while
 * rendering React component. Scripts inside React components are never
 * executed when rendering on the client." Researched rather than
 * guessed at a fix: this is a confirmed, currently-unresolved React 19 +
 * Next.js 16.2+ false positive, not specific to this codebase or this
 * script. `next-themes` (the most widely used React theme library, doing
 * the exact same "inline script before hydration" pattern this app's own
 * theme-init script does) hits the identical warning, tracked upstream
 * at https://github.com/pacocoursey/next-themes/issues/387 and
 * https://github.com/pacocoursey/next-themes/issues/385, and shadcn/ui's
 * own docs repo has an open issue asking for guidance on it,
 * https://github.com/shadcn-ui/ui/issues/10104, which describes it as
 * "technically a false positive since the script executes correctly
 * during server-side rendering." Next's own docs confirm
 * `beforeInteractive` scripts "will always be injected inside the `head`
 * of the HTML document regardless of where it's placed in the
 * component," so this app's placement was never the cause.
 *
 * One real fix exists in theory (`useServerInsertedHTML`, which injects
 * raw HTML into the server stream outside anything React's client-side
 * renderer ever sees, avoiding the warning at its root), but it was
 * deliberately NOT adopted here after checking how reliable its content
 * placement actually is: an open, unresolved Next.js discussion
 * (https://github.com/vercel/next.js/discussions/43551) reports that
 * hook's inserted content landing somewhere other than `<head>`,
 * inconsistently, for other users, which is exactly the wrong kind of
 * uncertainty to accept for a script whose entire job depends on running
 * before paint, on every request, for every visitor, with no real
 * browser in this sandbox to verify the change against before shipping
 * it. Given the choice between a confirmed-cosmetic console warning and
 * a code change with a real, unverifiable-here risk of reintroducing a
 * visible theme-flash regression, the warning stays. Revisit if Next.js
 * or React ship an official fix, or if this is verified safe in a real
 * browser first.
 */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("ultimate-theme");var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

/**
 * The nonce proxy.ts generates fresh per request (see its own comment)
 * and puts on both the `Content-Security-Policy` response header and this
 * `x-nonce` request header. Next.js reads the CSP header itself and
 * nonces its own framework/page scripts automatically, this explicit
 * read is only for the one script this app writes by hand below: the
 * theme-init script's inline body isn't something Next.js's own
 * automatic nonce handling reaches, `nonce={nonce}` on the `<Script>`
 * component is what the framework docs call out as still required.
 * Reading `headers()` here also does the necessary other half of the
 * job: it's what makes every route in this app dynamically rendered
 * (required for CSP nonces at all, a fresh nonce every request means no
 * response can be statically cached), and since this read is in the
 * root layout that wraps every route, it covers all of them from one
 * place rather than needing a `force-dynamic` export scattered into
 * every page.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce");

  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce ?? undefined}>
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      {/**
       * `suppressHydrationWarning` here too, not just on `<html>` above:
       * that one only silences mismatches in `<html>`'s own attributes,
       * React's own docs say it "only works one level deep." The mismatch
       * reported here (`data-new-gr-c-s-check-loaded`,
       * `data-gr-ext-installed`) is Grammarly's browser extension writing
       * those two attributes onto `<body>` before React hydrates, a
       * documented cause of this exact warning
       * (https://github.com/facebook/react/issues/24430), not anything
       * this app's own code does. It only shows up for a visitor who has
       * Grammarly (or a similar extension) installed, the server never
       * sends those attributes, there is nothing to "fix" in the
       * rendered output itself, only the noisy console warning.
       */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
