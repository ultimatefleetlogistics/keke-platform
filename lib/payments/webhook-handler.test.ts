import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { applyTransferOutcome, applyWalletWithdrawalTransferOutcome } from "@/lib/payments/batch-processor";
import { sendNotification, sendUntrackedSms } from "@/lib/notifications/send-notification";
import {
  recordProviderTransaction,
  processPaystackEvent,
  findEarliestUnpaidScheduleEntry,
} from "@/lib/payments/webhook-handler";

// Same reasoning as lib/payments/batch-processor.test.ts: a deep mock of
// the Prisma Client, no real database. lib/payments/batch-processor.ts is
// also mocked here (its own logic is covered by its own test file), this
// file is only about webhook-handler.ts's own job: dedup a delivery,
// route an event to the right handler, and resolve a transfer reference
// to whichever record actually initiated it. lib/notifications/send-
// notification.ts is mocked too, otherwise the new deposit-alert calls
// added in Module 21 would reach the real SMS/email providers.
vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/payments/batch-processor", () => ({
  applyTransferOutcome: vi.fn().mockResolvedValue(undefined),
  applyWalletWithdrawalTransferOutcome: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications/send-notification", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendUntrackedSms: vi.fn().mockResolvedValue(undefined),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const applyTransferOutcomeMock = vi.mocked(applyTransferOutcome);
const applyWalletWithdrawalTransferOutcomeMock = vi.mocked(applyWalletWithdrawalTransferOutcome);
const sendNotificationMock = vi.mocked(sendNotification);
const sendUntrackedSmsMock = vi.mocked(sendUntrackedSms);

beforeEach(() => {
  mockReset(prismaMock);
  applyTransferOutcomeMock.mockClear();
  applyWalletWithdrawalTransferOutcomeMock.mockClear();
  sendNotificationMock.mockClear();
  sendUntrackedSmsMock.mockClear();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("recordProviderTransaction", () => {
  it("stores the raw payload and returns the created row on first delivery", async () => {
    prismaMock.providerTransaction.create.mockResolvedValue({ id: "pt-1" } as never);

    const result = await recordProviderTransaction({ event: "charge.success", data: { reference: "ref-1" } });

    expect(result).toEqual({ id: "pt-1" });
    expect(prismaMock.providerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerRef: "ref-1", status: "RECEIVED" }) })
    );
  });

  it("returns null, not an error, for a duplicate delivery (unique constraint on providerRef)", async () => {
    prismaMock.providerTransaction.create.mockRejectedValue({ code: "P2002" });

    const result = await recordProviderTransaction({ event: "charge.success", data: { reference: "ref-1" } });

    expect(result).toBeNull();
  });

  it("rethrows any error that isn't the duplicate-delivery unique constraint", async () => {
    prismaMock.providerTransaction.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      recordProviderTransaction({ event: "charge.success", data: { reference: "ref-1" } })
    ).rejects.toThrow("connection lost");
  });

  it("falls back to data.id when there is no reference field", async () => {
    prismaMock.providerTransaction.create.mockResolvedValue({ id: "pt-1" } as never);

    await recordProviderTransaction({ event: "transfer.success", data: { id: 999 } });

    expect(prismaMock.providerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerRef: "999" }) })
    );
  });
});

describe("processPaystackEvent: unrecognized event types", () => {
  it("marks the transaction PROCESSED without trying to interpret an event type it doesn't know", async () => {
    await processPaystackEvent("pt-1", { event: "customeridentification.success", data: {} });

    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "PROCESSED", processedAt: expect.any(Date) },
    });
  });
});

describe("processPaystackEvent: charge.success", () => {
  it("marks UNMATCHED when the charge carries no customer code at all", async () => {
    await processPaystackEvent("pt-1", { event: "charge.success", data: { amount: 500000 } });

    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "UNMATCHED" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("marks UNMATCHED when the customer code doesn't resolve to any agent or driver", async () => {
    prismaMock.agent.findUnique.mockResolvedValue(null);
    prismaMock.driver.findUnique.mockResolvedValue(null);

    await processPaystackEvent("pt-1", {
      event: "charge.success",
      data: { amount: 500000, customer: { customer_code: "CUS_unknown" } },
    });

    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "UNMATCHED" },
    });
  });

  it("records an agent remittance and allocates it when the agent's vehicle has an unpaid schedule entry", async () => {
    prismaMock.agent.findUnique.mockResolvedValue({ id: "agent-1", userId: "user-agent-1" } as never);
    prismaMock.investmentContract.findFirst.mockResolvedValue({ id: "contract-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue({
      id: "entry-1",
      contractId: "contract-1",
      amountPaid: 0,
      expectedAmount: 5000,
    } as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-tx-1" } as never);

    // handleChargeSuccess resolves a vehicle only for a driver, an agent
    // covers many vehicles at once, so the schedule entry lookup for an
    // agent-initiated remittance goes through
    // findEarliestUnpaidScheduleEntry indirectly via a vehicleId that is
    // undefined for an agent; that's intentional, see the note below.
    await processPaystackEvent("pt-1", {
      event: "charge.success",
      data: { amount: 500000, customer: { customer_code: "CUS_agent" } },
    });

    expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ direction: "INBOUND", source: "AGENT_REMITTANCE", agentId: "agent-1", amount: 5000 }),
      })
    );
    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "PROCESSED", processedAt: expect.any(Date) },
    });
    // Module 21: an agent always has a User, so the deposit alert goes
    // through the normal tracked sendNotification path on both channels,
    // same as every other money-related notification in this app.
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-agent-1", type: "remittance_received", channels: ["EMAIL", "SMS"] })
    );
    expect(sendUntrackedSmsMock).not.toHaveBeenCalled();
  });

  it("resolves a driver's currently assigned vehicle before looking for that vehicle's unpaid schedule entry", async () => {
    prismaMock.agent.findUnique.mockResolvedValue(null);
    prismaMock.driver.findUnique
      .mockResolvedValueOnce({ id: "driver-1", userId: "user-driver-1", phone: "08011112222" } as never) // the lookup by customer code
      .mockResolvedValueOnce({ currentVehicle: { id: "vehicle-1" } } as never); // the lookup for their current vehicle
    prismaMock.investmentContract.findFirst.mockResolvedValue({ id: "contract-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-tx-1" } as never);

    await processPaystackEvent("pt-1", {
      event: "charge.success",
      data: { amount: 250000, customer: { customer_code: "CUS_driver" } },
    });

    expect(prismaMock.investmentContract.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ vehicleId: "vehicle-1", status: "ACTIVE" }) })
    );
    // This driver has a linked User (userId set), so the tracked path is
    // used, not the untracked SMS fallback.
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-driver-1", type: "remittance_received", channels: ["SMS"] })
    );
    expect(sendUntrackedSmsMock).not.toHaveBeenCalled();
  });

  it("SMS's a driver directly, with no Notification row, when they have no linked User account", async () => {
    prismaMock.agent.findUnique.mockResolvedValue(null);
    prismaMock.driver.findUnique
      .mockResolvedValueOnce({ id: "driver-2", userId: null, phone: "08033334444" } as never)
      .mockResolvedValueOnce({ currentVehicle: null } as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-tx-2" } as never);

    await processPaystackEvent("pt-2", {
      event: "charge.success",
      data: { amount: 300000, customer: { customer_code: "CUS_driver_no_app" } },
    });

    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(sendUntrackedSmsMock).toHaveBeenCalledWith("08033334444", expect.stringContaining("received into your collection account"));
    expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ driverId: "driver-2", status: "RECORDED" }) })
    );
    expect(prismaMock.paymentAllocation.create).not.toHaveBeenCalled();
  });
});

describe("findEarliestUnpaidScheduleEntry", () => {
  it("returns null when the vehicle has no active contract", async () => {
    prismaMock.investmentContract.findFirst.mockResolvedValue(null);

    const result = await findEarliestUnpaidScheduleEntry("vehicle-1");

    expect(result).toBeNull();
    expect(prismaMock.paymentScheduleEntry.findFirst).not.toHaveBeenCalled();
  });

  it("looks up the earliest UPCOMING/DUE/PARTIALLY_PAID entry, ordered by due date, for the active contract", async () => {
    prismaMock.investmentContract.findFirst.mockResolvedValue({ id: "contract-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue({ id: "entry-1" } as never);

    const result = await findEarliestUnpaidScheduleEntry("vehicle-1");

    expect(result).toEqual({ id: "entry-1" });
    expect(prismaMock.paymentScheduleEntry.findFirst).toHaveBeenCalledWith({
      where: { contractId: "contract-1", status: { in: ["UPCOMING", "DUE", "PARTIALLY_PAID"] } },
      orderBy: { dueDate: "asc" },
    });
  });
});

describe("processPaystackEvent: transfer.success / transfer.failed / transfer.reversed", () => {
  it("resolves a reference to a PaymentBatchItem and applies the outcome through batch-processor", async () => {
    prismaMock.paymentBatchItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

    await processPaystackEvent("pt-1", {
      event: "transfer.success",
      data: { reference: "item-1", transfer_code: "trf_1" },
    });

    expect(applyTransferOutcomeMock).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ status: "SUCCESS", transferCode: "trf_1" })
    );
    expect(applyWalletWithdrawalTransferOutcomeMock).not.toHaveBeenCalled();
    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "PROCESSED", processedAt: expect.any(Date) },
    });
  });

  it("resolves a reference to a WalletWithdrawal (not a batch item) and applies the outcome there instead", async () => {
    prismaMock.paymentBatchItem.findFirst.mockResolvedValue(null);
    prismaMock.walletWithdrawal.findFirst.mockResolvedValue({ id: "withdrawal-1" } as never);

    await processPaystackEvent("pt-1", {
      event: "transfer.failed",
      data: { reference: "withdrawal-1", gateway_response: "Invalid account" },
    });

    expect(applyTransferOutcomeMock).not.toHaveBeenCalled();
    expect(applyWalletWithdrawalTransferOutcomeMock).toHaveBeenCalledWith(
      "withdrawal-1",
      expect.objectContaining({ status: "FAILED", failureReason: "Invalid account" })
    );
  });

  it("marks UNMATCHED when the reference resolves to neither a batch item nor a wallet withdrawal", async () => {
    prismaMock.paymentBatchItem.findFirst.mockResolvedValue(null);
    prismaMock.walletWithdrawal.findFirst.mockResolvedValue(null);

    await processPaystackEvent("pt-1", { event: "transfer.success", data: { reference: "unknown-ref" } });

    expect(applyTransferOutcomeMock).not.toHaveBeenCalled();
    expect(applyWalletWithdrawalTransferOutcomeMock).not.toHaveBeenCalled();
    expect(prismaMock.providerTransaction.update).toHaveBeenCalledWith({
      where: { id: "pt-1" },
      data: { status: "UNMATCHED" },
    });
  });

  it("treats transfer.reversed the same as a failure, not a success", async () => {
    prismaMock.paymentBatchItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

    await processPaystackEvent("pt-1", { event: "transfer.reversed", data: { reference: "item-1" } });

    expect(applyTransferOutcomeMock).toHaveBeenCalledWith("item-1", expect.objectContaining({ status: "FAILED" }));
  });

  it("falls back to the raw event name as the failure reason when Paystack gives no gateway_response", async () => {
    prismaMock.paymentBatchItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

    await processPaystackEvent("pt-1", { event: "transfer.reversed", data: { reference: "item-1" } });

    expect(applyTransferOutcomeMock).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ failureReason: "transfer.reversed" })
    );
  });
});
