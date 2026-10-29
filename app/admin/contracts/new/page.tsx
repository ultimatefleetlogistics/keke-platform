import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAvailableVehicleOptions, getEffectiveVehicleTypeDefaults, getInvestorOptions } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { NewContractForm } from "./new-contract-form";

export default async function NewContractPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.CONTRACTS_CREATE)) {
    redirect("/admin/investors");
  }

  const [investors, vehicles, defaultTermsByType] = await Promise.all([
    getInvestorOptions(),
    getAvailableVehicleOptions(),
    getEffectiveVehicleTypeDefaults(),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">New investment contract</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Terms pre-fill based on the vehicle you pick, a car starts from different numbers than a keke or a bike,
          adjust any of them for this specific contract, nothing here is a hard coded rule.
        </div>
      </header>

      <div className="px-8 py-6">
        {investors.length === 0 || vehicles.length === 0 ? (
          <Card className="max-w-[560px] p-0">
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12h6m-6 4h6M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0v4h4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title={investors.length === 0 ? "No investors yet" : "No vehicles available"}
              description={
                investors.length === 0
                  ? "Add one first before you can write a new contract."
                  : "Every vehicle is already on an active contract, add a new vehicle first."
              }
            />
          </Card>
        ) : (
          <Card className="p-6">
            <NewContractForm investors={investors} vehicles={vehicles} defaultTermsByType={defaultTermsByType} />
          </Card>
        )}
      </div>
    </>
  );
}
