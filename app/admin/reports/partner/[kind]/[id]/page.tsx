import { redirect, notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrintButton } from "@/components/admin/print-button";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { formatDateTime, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPartnerStatement, type PartnerKind } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const KIND_LABEL: Record<PartnerKind, string> = { agent: "Agent", driver: "Driver", investor: "Investor" };

function isPartnerKind(value: string): value is PartnerKind {
  return value === "agent" || value === "driver" || value === "investor";
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function PartnerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view reports.
        </div>
      </div>
    );
  }

  const { kind, id } = await params;
  if (!isPartnerKind(kind)) notFound();

  const { from: fromParam, to: toParam } = await searchParams;
  const from = parseDateParam(fromParam);
  const to = parseDateParam(toParam);
  const range = from && to ? { from, to } : undefined;

  const statement = await getPartnerStatement({ kind, id, range });
  if (!statement) notFound();

  const basePath = `/admin/reports/partner/${kind}/${id}`;
  const exportHref = range
    ? `${basePath}/export?from=${toDateInputValue(from!)}&to=${toDateInputValue(to!)}`
    : `${basePath}/export`;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="text-[19px] font-extrabold tracking-tight">{statement.name}</div>
          <Badge variant="neutral">{KIND_LABEL[kind]}</Badge>
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          {statement.subtitle ?? KIND_LABEL[kind]}. Every payment recorded to or from this account,{" "}
          {range ? "for the range below" : "all time"}.
        </div>
      </header>
      <ReportsTabs active="/admin/reports" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="print:hidden flex flex-wrap items-end justify-between gap-3">
          <form method="get" className="flex flex-wrap items-end gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">From</label>
              <Input type="date" name="from" defaultValue={from ? toDateInputValue(from) : ""} className="w-44" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">To</label>
              <Input type="date" name="to" defaultValue={to ? toDateInputValue(to) : ""} className="w-44" />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Filter
            </Button>
            {range ? (
              <Button asChild size="sm" variant="ghost">
                <a href={basePath}>All time</a>
              </Button>
            ) : null}
          </form>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={exportHref}>Download CSV</a>
            </Button>
            <PrintButton />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total inflow</div>
            <div className="mt-0.5 text-xl font-extrabold text-good-ink">
              {formatNaira(statement.summary.totalInflow)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total outflow</div>
            <div className="mt-0.5 text-xl font-extrabold text-bad-ink">
              {formatNaira(statement.summary.totalOutflow)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Net</div>
            <div
              className={`mt-0.5 text-xl font-extrabold ${statement.summary.net >= 0 ? "text-good-ink" : "text-bad-ink"}`}
            >
              {formatNaira(statement.summary.net)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Transactions</div>
            <div className="mt-0.5 text-xl font-extrabold">{statement.summary.transactionCount}</div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Statement</div>
          </div>
          {statement.transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No transactions in this range.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                <span>Date</span>
                <span>Type</span>
                <span>Amount</span>
              </div>
              {statement.transactions.map((t, index) => (
                <div
                  key={t.id}
                  className={`grid grid-cols-[1.3fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span>{formatDateTime(t.createdAt)}</span>
                  <span className="text-text-soft">{t.sourceLabel}</span>
                  <span className={t.direction === "INBOUND" ? "text-good-ink" : "text-bad-ink"}>
                    {t.direction === "INBOUND" ? "+" : "-"}
                    {formatNaira(t.amount)}
                  </span>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
