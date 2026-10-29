import { redirect } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getVehicleTypeDefaultsForSettings } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { updateVehicleTypeDefaults } from "@/lib/actions/settings";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

export default async function ContractTermsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.SETTINGS_MANAGE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to manage system wide settings.
        </div>
      </div>
    );
  }

  const { saved } = await searchParams;
  const defaultsByType = await getVehicleTypeDefaultsForSettings();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Contract defaults</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          What pre-fills on <span className="font-semibold">/admin/contracts/new</span> once a vehicle type is
          picked. Every contract can still override these per contract, this only changes the starting point.
        </div>
      </header>

      <div className="px-8 py-6">
        {saved ? (
          <div className="mb-4 max-w-[720px] rounded-xl bg-good-soft px-4 py-3 text-[12.5px] font-semibold text-good-ink">
            Saved. The next contract created for any of these vehicle types will pre-fill with these numbers.
          </div>
        ) : null}

        <ActionForm action={updateVehicleTypeDefaults} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          {VEHICLE_TYPES.map((type) => {
            const terms = defaultsByType[type];
            const prefix = type.toLowerCase();
            return (
              <Card key={type} className="p-5">
                <div className="mb-3.5 flex items-center gap-2">
                  <div className="text-[15px] font-extrabold">{VEHICLE_TYPE_LABELS[type]}</div>
                  <Badge variant={terms.isOverridden ? "accent" : "neutral"}>
                    {terms.isOverridden ? "Custom" : "Built-in default"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}_principalAmount`}>Principal amount (NGN)</Label>
                    <Input
                      id={`${prefix}_principalAmount`}
                      name={`${prefix}_principalAmount`}
                      type="number"
                      step="0.01"
                      min="1"
                      defaultValue={terms.principalAmount}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}_targetPayoutAmount`}>Target payout amount (NGN)</Label>
                    <Input
                      id={`${prefix}_targetPayoutAmount`}
                      name={`${prefix}_targetPayoutAmount`}
                      type="number"
                      step="0.01"
                      min="1"
                      defaultValue={terms.targetPayoutAmount}
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}_installmentAmount`}>Installment amount (NGN)</Label>
                    <Input
                      id={`${prefix}_installmentAmount`}
                      name={`${prefix}_installmentAmount`}
                      type="number"
                      step="0.01"
                      min="1"
                      defaultValue={terms.installmentAmount}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}_paymentFrequency`}>Payment frequency</Label>
                    <select
                      id={`${prefix}_paymentFrequency`}
                      name={`${prefix}_paymentFrequency`}
                      defaultValue={terms.paymentFrequency}
                      className={SELECT_CLASS}
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Biweekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}_termMonths`}>Term (months)</Label>
                    <Input
                      id={`${prefix}_termMonths`}
                      name={`${prefix}_termMonths`}
                      type="number"
                      min="1"
                      max="60"
                      defaultValue={terms.termMonths}
                      required
                    />
                  </div>
                </div>
              </Card>
            );
          })}
          </div>

          <div className="flex justify-end">
            <ActionSubmitButton>Save all</ActionSubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
