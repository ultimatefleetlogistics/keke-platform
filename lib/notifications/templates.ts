import { formatNaira } from "@/lib/utils";

/**
 * Module 53: the bank-style receipt design approved for every transaction
 * alert (deposits, payouts, withdrawals, remittances) — SMS as a
 * field-by-field "Credit/Debit/Declined" message, email as a branded
 * receipt card. Both render from the same `AlertDetails`, so the two
 * channels never drift apart on what a given transaction actually says.
 *
 * Deliberately its own module rather than folded into send-notification.ts:
 * this is pure formatting (no I/O, no Prisma), easy to unit test and easy
 * to reuse from sendUntrackedSms's callers, which never go through
 * sendNotification's Notification-row bookkeeping at all.
 */

export type AlertKind = "CREDIT" | "DEBIT" | "DECLINED";

export type AlertDetails = {
  kind: AlertKind;
  /** Naira amount, whole units — same convention as formatNaira everywhere else. */
  amount: number;
  /** Short, human-scannable reference, e.g. from shortRef() below. */
  reference: string;
  /** One line: what this transaction was. May be staff-typed free text
   *  (a decline reason), so callers must not trust it as pre-sanitized. */
  desc: string;
  /** Resulting balance, when this transaction actually has one to report
   *  (a wallet credit/debit). Omitted entirely for money that left to a
   *  bank account, where there is no running balance to state. */
  balance?: number;
  /** Defaults to "Bal" (SMS) / "Wallet balance now" (email). Override for
   *  a case where "balance" reads wrong, e.g. a declined withdrawal that
   *  was never actually debited ("Still in your wallet"). */
  balanceLabel?: string;
  /** Defaults to now. Accepts a past date so a webhook processed slightly
   *  late still reports when the transaction actually happened. */
  occurredAt?: Date;
};

// Module 53 round 1: placeholder pending the real support address being
// confirmed — every alert email's footer reads from this one constant, so
// updating it once updates every template.
export const ALERT_SUPPORT_EMAIL = "support@ultimate.africa";

/**
 * Turns a Prisma id (long cuid/uuid) into something a person can actually
 * read in an SMS or a receipt, e.g. shortRef(id, "RMT-") -> "RMT-9F2A7C1D".
 * Deliberately not a new sequential column: this reuses the id every
 * record already has, no migration, and it's still unique enough (8 hex-ish
 * characters) that two references colliding is not a realistic concern for
 * a support conversation ("which RMT-9F2A7C1D transaction do you mean").
 */
export function shortRef(id: string, prefix = ""): string {
  return `${prefix}${id.slice(-8).toUpperCase()}`;
}

function kindWord(kind: AlertKind): string {
  return kind === "CREDIT" ? "Credit" : kind === "DEBIT" ? "Debit" : "Declined";
}

function formatSmsDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Collapses embedded newlines/tabs (free text can contain them) and caps
 *  length so one long staff-typed decline reason can't silently push an
 *  SMS into a second, double-cost segment. Email shows the untruncated
 *  version instead, see buildAlertEmailHtml. */
function smsSafeDesc(desc: string, max = 60): string {
  const flattened = desc.replace(/\s+/g, " ").trim();
  return flattened.length > max ? `${flattened.slice(0, max - 1).trimEnd()}…` : flattened;
}

/**
 * Field-by-field SMS, the format approved from the AccessBank reference:
 * Credit/Debit/Declined, Amt, (Bal, when there is one), Desc or Reason,
 * Date. No sender name repeated in the body — Termii's Sender ID already
 * shows as who the text is from, see TERMII_SENDER_ID in provider setup.
 */
export function buildAlertSms(alert: AlertDetails): string {
  const lines = [kindWord(alert.kind), `Amt:${formatNaira(alert.amount)}`];
  if (alert.balance !== undefined) {
    lines.push(`${alert.balanceLabel ?? "Bal"}:${formatNaira(alert.balance)}`);
  }
  const descLabel = alert.kind === "DECLINED" ? "Reason" : "Desc";
  lines.push(`${descLabel}:${smsSafeDesc(alert.desc)}`);
  lines.push(`Date:${formatSmsDate(alert.occurredAt ?? new Date())}`);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Receipt-style HTML email, the design approved from the transfer-receipt
 * reference: status glyph, big amount, a details table, balance called out
 * separately when there is one. Table-based layout with every style
 * inlined on purpose — this goes through Resend into real inboxes
 * (Outlook desktop included), not a browser, so no <style> block, no
 * flexbox, no CSS variables; every value that could contain staff-typed
 * free text (desc, reference, heading) is HTML-escaped before it's
 * concatenated in, since a decline reason is exactly the kind of field a
 * careless or malicious input could otherwise break the layout with, or
 * worse, use to inject markup into an email sent from our own domain.
 */
export function buildAlertEmailHtml(heading: string, alert: AlertDetails): string {
  const isBad = alert.kind === "DECLINED";
  const statusBg = isBad ? "#FBE7E7" : "#E7F7E7";
  const statusColor = isBad ? "#d03b3b" : "#0ca30c";
  const glyph = isBad ? "!" : "&#10003;";
  const dateStr = (alert.occurredAt ?? new Date()).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const rows: Array<[string, string]> = [
    [alert.kind === "DECLINED" ? "Reason" : "Description", alert.desc],
    ["Reference", alert.reference],
    ["Date", dateStr],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="color:#8A8F86;padding:6px 0;font-size:12.5px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
          <td align="right" style="color:#14171A;font-weight:600;padding:6px 0;font-size:12.5px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  const balanceHtml =
    alert.balance !== undefined
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FCEEDA;border-radius:10px;margin-top:16px;">
          <tr>
            <td style="padding:12px 14px;font-size:12px;font-weight:bold;color:#7A4A05;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(alert.balanceLabel ?? "Wallet balance now")}</td>
            <td align="right" style="padding:12px 14px;font-size:14px;font-weight:800;color:#7A4A05;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(formatNaira(alert.balance))}</td>
          </tr>
        </table>`
      : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F3;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border:1px solid #E7E9E4;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#1F1A12;padding:16px 20px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:14px;color:#FDF6EA;">UFLogistics</span>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 24px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" valign="middle" width="46" height="46" style="background:${statusBg};border-radius:50%;font-size:20px;line-height:46px;color:${statusColor};font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${glyph}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:15px;font-weight:bold;color:#14171A;text-align:center;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(heading)}</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#14171A;text-align:center;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(formatNaira(alert.amount))}</p>
            <hr style="border:none;border-top:1px solid #E7E9E4;margin:20px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
            ${balanceHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;background:#F5F7F3;border-top:1px solid #E7E9E4;text-align:center;font-size:10.5px;color:#8A8F86;font-family:Arial,Helvetica,sans-serif;">
            Automated message from UFLogistics &middot; ${escapeHtml(ALERT_SUPPORT_EMAIL)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}
