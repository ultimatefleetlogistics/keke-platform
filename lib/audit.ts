import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditLogInput = {
  actorUserId: string;
  action: string; // e.g. "payment_batch.approve", dot-separated entity.verb, see the AuditLog model comment
  entityType: string; // e.g. "PaymentBatch", the Prisma model name of the thing being acted on
  entityId: string;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
};

/**
 * Records one row on the staff decision this app already treats as
 * sensitive enough to gate behind a permission: an approval, a rejection,
 * a role or permission change, a destructive delete. This never throws,
 * same discipline as sendNotification in
 * lib/notifications/send-notification.ts, an audit entry failing to write
 * must never make an otherwise successful staff action look like it
 * failed. Pass a `tx` (a Prisma.TransactionClient) when the write belongs
 * inside the same transaction as the business change it is recording, so
 * the two can never disagree about whether something actually happened;
 * otherwise this defaults to the shared client and writes on its own
 * right after.
 */
export async function writeAuditLog(
  input: AuditLogInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState ?? undefined,
        afterState: input.afterState ?? undefined,
      },
    });
  } catch (error) {
    console.error(`Failed to write audit log entry for "${input.action}"`, error);
    Sentry.captureException(error, {
      contexts: { auditLog: { action: input.action, entityType: input.entityType, entityId: input.entityId } },
    });
  }
}
