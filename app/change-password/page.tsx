import { redirect } from "next/navigation";

import { KekeIcon, KekeWatermark } from "@/components/design-system/keke-icon";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "./change-password-form";

/**
 * One shared page for every portal (Module 26), not nested under
 * app/admin, app/investor, app/agent, or app/driver, the same reasoning
 * as /kyc: any signed-in account of any kind can land here, so it can't
 * live behind a portal-specific layout that would redirect the wrong
 * kind of account away before this ever renders.
 *
 * Reached two ways: forced, when User.mustChangePassword is true (every
 * portal layout redirects here before rendering anything else, see each
 * layout.tsx), for an account someone else created with a generated
 * temporary password; or voluntarily, via the "Change password" link in
 * AppShell's account area, available to everyone all the time. Both
 * cases use the exact same form and the exact same changePassword action,
 * only the header copy and the current-password field's label differ.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const homePath = user.staff
    ? "/admin/dashboard"
    : user.agent
      ? "/agent/dashboard"
      : user.driver
        ? "/driver/dashboard"
        : user.investor
          ? "/investor/dashboard"
          : "/sign-in";

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#1F1A12] px-6 py-10">
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-surface p-8 shadow-card">
        <KekeWatermark className="pointer-events-none absolute -right-14 -top-10 h-[160px] w-[210px]" opacity={0.05} />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
            <KekeIcon className="h-[18px] w-[18px]" color="white" />
          </div>
          <span className="text-[17px] font-bold">Ultimate</span>
        </div>

        <div className="relative z-10 mt-6">
          <div className="text-[21px] font-extrabold tracking-tight">
            {user.mustChangePassword ? "Choose your own password" : "Change password"}
          </div>
          <div className="mt-1.5 text-[13px] leading-5 text-text-soft">
            {user.mustChangePassword
              ? "You're signed in with a temporary password someone generated for you. Enter it once more here, then choose a permanent one only you know."
              : "Enter your current password, then choose a new one."}
          </div>

          <ChangePasswordForm homePath={homePath} isForced={user.mustChangePassword} />
        </div>
      </div>
    </div>
  );
}
