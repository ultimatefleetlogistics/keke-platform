import { formatNaira } from "@/lib/utils";

/**
 * Turns the dot/underscore-separated action key every writeAuditLog call
 * passes (see lib/audit.ts's own comment: "payment_batch.approve",
 * "investor.bank_details.update") into a readable breadcrumb for the
 * /admin/audit-log page, instead of showing staff the raw code-identifier
 * string. Deliberately generic rather than a lookup table keyed by every
 * exact action string that exists today: a mechanical split-and-title-case
 * means a brand new action added anywhere in this app (a new call site to
 * writeAuditLog, no change here required) still reads as a normal phrase
 * instead of falling back to its raw form the moment nobody remembers to
 * add it to a list.
 */
export function humanizeAuditAction(action: string): string {
  return action
    .split(".")
    .map((segment) =>
      segment
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" › ");
}

/** camelCase or snake_case object key -> "Title Case" label, e.g. "investorWalletBalance" -> "Investor Wallet Balance". */
function humanizeFieldKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** True for a value that reads as a code-style enum/status constant ("PENDING_APPROVAL", "APPROVED"), not free text a staff member typed (a reason, a note) or a code/number string ("058"). Requires at least one letter so a pure digit/code string is left untouched. */
function looksLikeShoutyConstant(value: string): boolean {
  return /^[A-Z0-9_\s]+$/.test(value) && /[A-Z]/.test(value);
}

function humanizeShoutyConstant(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * One value out of a beforeState/afterState object, formatted for display.
 * `key` is passed alongside the value purely so a field whose name reads as
 * money ("amount", "investorWalletBalance", ...) renders through
 * formatNaira instead of as a bare number — every such field across this
 * app's writeAuditLog calls is already a plain Naira number (never kobo,
 * never a Decimal), see e.g. lib/actions/contracts.ts's
 * recordHistoricalPayout, so no unit conversion is needed here, only the
 * ₦ formatting itself.
 */
function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return /amount|balance/i.test(key) ? formatNaira(value) : value.toLocaleString("en-NG");
  }
  if (typeof value === "string") {
    return looksLikeShoutyConstant(value) ? humanizeShoutyConstant(value) : value;
  }
  // Every real call site only ever passes flat string/number/boolean/null
  // fields (lib/audit.ts's own doc comment), this is just a safety net so
  // an unexpected nested object/array still renders as something instead
  // of crashing the page.
  return JSON.stringify(value);
}

export type AuditDiffRow = { key: string; label: string; before: string; after: string };

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Reduces a beforeState/afterState pair down to only the fields that
 * actually changed, each rendered as one readable "Field: before → after"
 * row, rather than two full raw JSON dumps side by side. A field present
 * in only one side (a brand new record's afterState, with no beforeState
 * at all) shows "—" on the missing side rather than being left out, so a
 * creation-type entry still reads as a full list of what was set.
 *
 * Returns null when either side is present but isn't a plain object (an
 * array or bare primitive, something no real writeAuditLog call in this
 * app has ever passed) — the caller falls back to a raw JSON dump for
 * that case instead of guessing how to display it.
 */
export function diffAuditStates(beforeState: unknown, afterState: unknown): AuditDiffRow[] | null {
  if (beforeState !== null && beforeState !== undefined && asPlainRecord(beforeState) === null) return null;
  if (afterState !== null && afterState !== undefined && asPlainRecord(afterState) === null) return null;

  const before = asPlainRecord(beforeState) ?? {};
  const after = asPlainRecord(afterState) ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const rows: AuditDiffRow[] = [];
  for (const key of keys) {
    const beforeText = key in before ? formatFieldValue(key, before[key]) : "—";
    const afterText = key in after ? formatFieldValue(key, after[key]) : "—";
    if (beforeText === afterText) continue;
    rows.push({ key, label: humanizeFieldKey(key), before: beforeText, after: afterText });
  }
  return rows;
}
