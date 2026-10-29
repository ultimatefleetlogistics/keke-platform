import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Where the CSP header (proxy.ts) sends violation reports. Before this
 * route existed, the only way anyone found out this app's
 * Content-Security-Policy had blocked something it shouldn't have (or
 * caught something it should) was a developer manually opening the
 * browser console on the right page at the right time, see proxy.ts's
 * own comment ("the user should still watch the browser console for CSP
 * violation reports"). This closes that gap the same way every other
 * silent-failure path in this app already does, by reporting to Sentry
 * (see e.g. lib/notifications/send-notification.ts, the webhook handler
 * at app/api/webhooks/paystack/route.ts), not by inventing a new
 * reporting mechanism.
 *
 * Deliberately unauthenticated: a browser sends these reports on its own,
 * with no session and no way to attach a bearer token, the same
 * unauthenticated-by-design shape as the Paystack webhook next to this
 * one in app/api/, just verified differently (a signature there, nothing
 * here, since there is no shared secret a browser's CSP engine could
 * carry). A public report endpoint can in principle be hit directly by
 * something other than a real browser to generate noise; Sentry's own
 * issue grouping (every report below is captured with a fingerprint keyed
 * on the violated directive and blocked URI) keeps a flood of identical
 * reports from becoming a flood of separate alerts, the same grouping
 * behavior every other Sentry.capture* call in this app already relies
 * on rather than this app rolling its own dedup layer. Real abuse volume
 * that actually costs Sentry quota is a known, industry-standard tradeoff
 * of any public CSP report endpoint, not something worth solving here
 * ahead of it ever mattering.
 *
 * Handles both shapes a browser can send, depending on which CSP
 * directive told it to: the older `report-uri` (what proxy.ts's CSP
 * header uses, for the widest browser support), Content-Type
 * `application/csp-report`, body `{ "csp-report": { ... } }`; and the
 * newer Reporting API's `report-to`, Content-Type `application/
 * reports+json`, body a JSON array of `{ type, url, body }`. Neither is
 * trusted as anything but a browser's own report, this never touches the
 * database or any business logic, it only ever reaches Sentry.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let reports: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(rawBody);
    if (Array.isArray(parsed)) {
      // Reporting API shape: each entry's actual violation detail is
      // nested under `body`.
      reports = parsed
        .filter((entry) => entry && typeof entry === "object" && entry.type === "csp-violation")
        .map((entry) => (entry.body && typeof entry.body === "object" ? entry.body : entry));
    } else if (parsed && typeof parsed === "object" && "csp-report" in parsed) {
      reports = [parsed["csp-report"]];
    }
  } catch {
    // Not valid JSON, nothing safe to report on, still acknowledge so the
    // browser doesn't retry a report that will never parse.
  }

  for (const report of reports) {
    const violatedDirective =
      (report["violated-directive"] as string | undefined) ??
      (report["violatedDirective"] as string | undefined) ??
      "unknown-directive";
    const blockedUri =
      (report["blocked-uri"] as string | undefined) ?? (report["blockedURL"] as string | undefined) ?? "unknown-uri";
    const documentUri =
      (report["document-uri"] as string | undefined) ?? (report["documentURL"] as string | undefined) ?? "unknown-page";

    Sentry.captureMessage(`CSP violation: ${violatedDirective}`, {
      level: "warning",
      fingerprint: ["csp-violation", violatedDirective, blockedUri],
      contexts: { csp: { violatedDirective, blockedUri, documentUri, report } },
    });
  }

  return new NextResponse(null, { status: 204 });
}
