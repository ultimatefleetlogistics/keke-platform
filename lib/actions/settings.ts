"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { VEHICLE_TYPES, contractTermsSettingKey, type DefaultContractTerms } from "@/lib/vehicle-types";
import { writeAuditLog } from "@/lib/audit";

const VALID_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

/**
 * Saves an admin's override of the default contract terms for all three
 * vehicle types at once, so /admin/contracts/new pre-fills from these
 * instead of the hard-coded fallback in lib/vehicle-types.ts. This is the
 * concrete answer to "not every setting should need a code change", the
 * SystemSetting table existed in the schema from the start but had no
 * reader or writer anywhere until now.
 *
 * Module 43: the two per-type validation throws below converted to a
 * `{ error?: string }` return, this was bound to a plain
 * `<form action={updateVehicleTypeDefaults}>` on
 * `/admin/settings/contract-terms`, see
 * `components/ui/action-form.tsx`'s doc comment. Note this keeps its
 * pre-existing behavior of saving each vehicle type as it validates, so a
 * later type failing validation does not undo an earlier type already
 * saved in this same submission, that part is unchanged by this module.
 */
export async function updateVehicleTypeDefaults(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.SETTINGS_MANAGE);

  for (const type of VEHICLE_TYPES) {
    const prefix = type.toLowerCase();

    const principalAmount = Number(formData.get(`${prefix}_principalAmount`));
    const targetPayoutAmount = Number(formData.get(`${prefix}_targetPayoutAmount`));
    const installmentAmount = Number(formData.get(`${prefix}_installmentAmount`));
    const termMonths = Number(formData.get(`${prefix}_termMonths`));
    const paymentFrequencyInput = String(formData.get(`${prefix}_paymentFrequency`) ?? "");

    if (
      !Number.isFinite(principalAmount) || principalAmount <= 0 ||
      !Number.isFinite(targetPayoutAmount) || targetPayoutAmount <= 0 ||
      !Number.isFinite(installmentAmount) || installmentAmount <= 0 ||
      !Number.isFinite(termMonths) || termMonths <= 0
    ) {
      return { error: `Every ${type} field must be a positive number.` };
    }
    if (!(VALID_FREQUENCIES as readonly string[]).includes(paymentFrequencyInput)) {
      return { error: `${type} has an invalid payment frequency.` };
    }

    const terms: DefaultContractTerms = {
      principalAmount,
      targetPayoutAmount,
      installmentAmount,
      paymentFrequency: paymentFrequencyInput as DefaultContractTerms["paymentFrequency"],
      termMonths,
    };

    const key = contractTermsSettingKey(type);
    const existing = await prisma.systemSetting.findUnique({ where: { key } });

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: terms, updatedById: user.staff?.id ?? null },
      create: {
        key,
        value: terms,
        description: `Default contract terms pre-filled when staff create a new ${type} contract`,
        updatedById: user.staff?.id ?? null,
      },
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: "system_setting.update",
      entityType: "SystemSetting",
      entityId: key,
      beforeState: existing ? { value: existing.value as Prisma.InputJsonValue } : null,
      afterState: { value: terms },
    });
  }

  redirect("/admin/settings/contract-terms?saved=1");
}
