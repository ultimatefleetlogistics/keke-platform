"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, assertDifferentActor, ForbiddenError } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { sendNotification } from "@/lib/notifications/send-notification";
import { writeAuditLog } from "@/lib/audit";

/**
 * Ownership transfer workflow. A transfer row is created automatically the
 * moment a contract's totalPaidToInvestor reaches its target payout amount
 * (see lib/payments/batch-processor.ts), but reaching the target never
 * moves the vehicle on its own, a staff member always verifies the numbers
 * and a different staff member always approves before it's considered
 * done, same maker-checker discipline as payment batches.
 *
 * Module 43: every real, user-reachable status-guard throw below ("isn't
 * waiting on verification," "hasn't been verified yet," "already X")
 * converted to a `{ error?: string }` return, these were bound to plain
 * `<form action={fn}>`s on `/admin/transfers/[id]`, see
 * `components/ui/action-form.tsx`'s doc comment. The `ForbiddenError`
 * throws (missing permission, or the maker-checker "approver must differ
 * from the verifier" rule) are left throwing, matching this codebase's
 * convention: the UI already hides the button in both cases, reaching
 * either needs a bypassed request, not the real page.
 */

export async function verifyOwnershipTransfer(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.TRANSFER_VERIFY);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.TRANSFER_VERIFY);

  const transferId = String(formData.get("transferId") ?? "");
  const transfer = await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: transferId } });

  if (transfer.status !== "TARGET_ACHIEVED" && transfer.status !== "REJECTED") {
    return { error: "This transfer isn't waiting on verification." };
  }

  await prisma.$transaction([
    prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "VERIFIED", verifiedById: user.staff.id, verifiedAt: new Date(), notes: null },
    }),
    prisma.investmentContract.update({
      where: { id: transfer.contractId },
      data: { status: "TRANSFER_IN_PROGRESS" },
    }),
  ]);
  await writeAuditLog({
    actorUserId: user.id,
    action: "ownership_transfer.verify",
    entityType: "OwnershipTransfer",
    entityId: transferId,
    beforeState: { status: transfer.status },
    afterState: { status: "VERIFIED" },
  });

  revalidatePath(`/admin/transfers/${transferId}`);
  revalidatePath("/admin/transfers");
}

/**
 * Approving is the final step, there is no separate "mark completed"
 * action, the moment a different staff member signs off, the contract is
 * done and the vehicle is considered handed over.
 */
export async function approveOwnershipTransfer(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.TRANSFER_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.TRANSFER_APPROVE);

  const transferId = String(formData.get("transferId") ?? "");
  const transfer = await prisma.ownershipTransfer.findUniqueOrThrow({
    where: { id: transferId },
    include: { fromInvestor: true, vehicle: true },
  });

  if (transfer.status !== "VERIFIED") {
    return { error: "This transfer hasn't been verified yet." };
  }
  if (transfer.verifiedById) {
    assertDifferentActor(transfer.verifiedById, user.staff.id, "Approve ownership transfer");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "COMPLETED", approvedById: user.staff.id, approvedAt: now, completedAt: now },
    }),
    prisma.investmentContract.update({
      where: { id: transfer.contractId },
      data: { status: "COMPLETED" },
    }),
  ]);
  await writeAuditLog({
    actorUserId: user.id,
    action: "ownership_transfer.approve",
    entityType: "OwnershipTransfer",
    entityId: transferId,
    beforeState: { status: transfer.status },
    afterState: { status: "COMPLETED" },
  });

  await sendNotification({
    userId: transfer.fromInvestor.userId,
    type: "ownership_transfer_completed",
    title: "Ownership transfer completed",
    body: `The ownership transfer for ${transfer.vehicle.assetTag} has been approved and completed.`,
    channels: ["EMAIL", "SMS"],
  });

  revalidatePath(`/admin/transfers/${transferId}`);
  revalidatePath("/admin/transfers");
}

/**
 * Sends a transfer back for correction rather than terminating it outright,
 * since the underlying trigger (the numbers crossing the target) doesn't
 * un-happen. Rejecting resets it to a state that can be verified again.
 */
export async function rejectOwnershipTransfer(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.TRANSFER_VERIFY);

  const hasVerify = user.permissions.has(PERMISSIONS.TRANSFER_VERIFY);
  const hasApprove = user.permissions.has(PERMISSIONS.TRANSFER_APPROVE);
  if (!hasVerify && !hasApprove) {
    throw new ForbiddenError(PERMISSIONS.TRANSFER_VERIFY);
  }

  const transferId = String(formData.get("transferId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const transfer = await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: transferId } });

  if (transfer.status === "COMPLETED" || transfer.status === "REJECTED") {
    return { error: `This transfer is already ${transfer.status.toLowerCase()}.` };
  }

  await prisma.$transaction([
    prisma.ownershipTransfer.update({
      where: { id: transferId },
      data: { status: "REJECTED", notes: notes || "Rejected, no reason given." },
    }),
    prisma.investmentContract.update({
      where: { id: transfer.contractId },
      data: { status: "TARGET_ACHIEVED" },
    }),
  ]);
  await writeAuditLog({
    actorUserId: user.id,
    action: "ownership_transfer.reject",
    entityType: "OwnershipTransfer",
    entityId: transferId,
    beforeState: { status: transfer.status },
    afterState: { status: "REJECTED", notes: notes || "Rejected, no reason given." },
  });

  revalidatePath(`/admin/transfers/${transferId}`);
  revalidatePath("/admin/transfers");
}
