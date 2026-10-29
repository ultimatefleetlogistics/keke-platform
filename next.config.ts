import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests to its own dev-only
  // resources (HMR, static chunks) by default, a DNS-rebinding protection.
  // That's normally invisible on localhost, but this app is also reached
  // from the keke-mobile app on a phone over the LAN (see
  // `next dev -H 0.0.0.0` in package.json's "dev" script and
  // EXPO_PUBLIC_API_BASE_URL in keke-mobile/.env.local), which counts as
  // a different origin and got silently blocked without this. If the PC's
  // LAN IP changes (a new Wi-Fi network, a router restart), this list and
  // keke-mobile/.env.local's EXPO_PUBLIC_API_BASE_URL both need the new IP,
  // `ipconfig`'s "Wireless LAN adapter Wi-Fi" section has the current one,
  // not any VirtualBox/VMware/vEthernet adapter also listed there.
  allowedDevOrigins: ["10.10.10.11"],
  experimental: {
    // KYC document uploads (government ID, proof of address) go through a
    // Server Action, the default 1MB body limit is too small for a scanned
    // ID or a phone photo, the KYC page's own copy already promises "up to
    // 5 MB", this gives a little headroom above that.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // Round seven security audit: this app had no security response headers
  // at all before this, Next.js doesn't set any by default. These five are
  // the safe, well-understood ones, none of them restrict what this app's
  // own pages can load or run, they only restrict how OTHER sites can
  // embed or reference this one, so they carry none of the risk a strict
  // Content-Security-Policy would.
  //
  // The Content-Security-Policy itself now lives in proxy.ts, not here:
  // it needs a fresh, unpredictable nonce on every single request (so the
  // one inline `<script>` this app ships, the theme-init script in
  // app/layout.tsx, can be allow-listed by that one request's nonce
  // without allow-listing inline scripts in general), and this headers()
  // function only runs once per matched route pattern at a level static
  // strings can express, it has no way to mint something different on
  // every request. See proxy.ts's own comment for the full CSP and the
  // reasoning behind each directive.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stops this app from ever being framed by another site
          // (clickjacking): a page handling real payment approvals and
          // admin actions should never be embeddable in an <iframe> on
          // somewhere else's domain.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser from "helpfully" reinterpreting a response's
          // declared Content-Type (e.g. treating an uploaded KYC document
          // as HTML/script because it sniffed something that looked like
          // markup inside it).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Never sends this app's full URL (which can carry a
          // `redirectedFrom` path, see proxy.ts) to a third-party site a
          // link is clicked through to; still allows it same-origin,
          // where it's genuinely useful.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Explicitly opts this origin out of every sensitive browser
          // capability it doesn't use (camera, microphone, geolocation,
          // etc.), so an XSS elsewhere in the browser chain can't abuse
          // one through this origin even in principle.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Forces HTTPS on every future visit for a year, including
          // subdomains; safe to set unconditionally, Vercel (and every
          // realistic deployment target for this app) already serves
          // exclusively over HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

// Wraps the config with Sentry's build-time plugin: it injects the
// instrumentation hooks (see instrumentation.ts/instrumentation-client.ts)
// and, when SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are set, uploads
// source maps so a captured error shows real file names and line numbers
// instead of minified ones. All three are optional, build-time only, and
// never shipped to the browser, leave them unset and the plugin just skips
// the upload step with a note in the build log, everything else about
// Sentry still works.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  // Not `disableLogger`, that option is deprecated and has no effect under
  // Turbopack (which `next build` uses here) anyway, its replacement
  // (`webpack.treeshake.removeDebugLogging`) is webpack only too.
});
