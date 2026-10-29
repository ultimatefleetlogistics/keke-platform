import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { applyTransferOutcome, applyWalletHold, applyWalletWithdrawalTransferOutcome } from "@/lib/payments/batch-processor";

/**
 * This app's Prisma Client needs a real query engine binary to talk to
 * Postgres, and that binary can only be fetched from binaries.prisma.sh,
 * which is blocked in the sandbox this suite was written in (see the
 * Known gaps section of docs/architecture/CURRENT_STATE.md). A real
 * integration test against a live database therefore cannot run here.
 * What follows instead is a unit test against a deep mock of the Prisma
 * Client: every `prisma.x.y()` call is a vi.fn() this file controls the
 * return value of, and `$transaction` is wired to just invoke its
 * callback with the same mock as `tx`, so a call inside a transaction and
 * a call outside one land on the same assertions. This proves the
 * business logic in batch-processor.ts makes the right calls with the
 * right data for a given starting state, it does not prove Postgres will
 * actually accept those calls, that half still needs a real database, see
 * "Testing against a local Postgres database" in the README.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/notifications/send-notification", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const sendNotificationMock = vi.mocked(sendNotification);

beforeEach(() => {
  mockReset(prismaMock);
  sendNotificationMock.mockClear();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

/** A PaymentBatchItem row in its pre-transfer state, PENDING and BANK routed unless overridden. */
function makeBatchItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    batchId: "batch-1",
    contractId: "contract-1",
    investorId: "investor-1",
    amount: 5000,
    transferStatus: "PENDING",
    paystackTransferCode: null,
    failureReason: null,
    payoutDestination: "BANK",
    ...overrides,
  };
}

/** An InvestmentContract comfortably under its target, ACTIVE, unless overridden. */
function makeContract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "contract-1",
    investorId: "investor-1",
    vehicleId: "vehicle-1",
    status: "ACTIVE",
    totalPaidToInvestor: 20000,
    targetPayoutAmount: 100000,
    ...overrides,
  };
}

describe("applyTransferOutcome", () => {
  it("is a no-op once the item is already SUCCESS, never touching the ledger again", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem({ transferStatus: "SUCCESS" }) as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.paymentBatchItem.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("is a no-op once the item is already FAILED", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem({ transferStatus: "FAILED" }) as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.paymentBatchItem.update).not.toHaveBeenCalled();
  });

  it("records a PENDING outcome without touching the ledger", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem() as never);

    await applyTransferOutcome("item-1", { status: "PENDING", transferCode: "trf_1" });

    expect(prismaMock.paymentBatchItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { transferStatus: "PENDING", paystackTransferCode: "trf_1" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("records a FAILED outcome with the failure reason, without touching the ledger", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem() as never);

    await applyTransferOutcome("item-1", { status: "FAILED", failureReason: "Invalid account" });

    expect(prismaMock.paymentBatchItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { transferStatus: "FAILED", paystackTransferCode: undefined, failureReason: "Invalid account" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("defaults the failure reason when the provider didn't give one", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem() as never);

    await applyTransferOutcome("item-1", { status: "FAILED" });

    expect(prismaMock.paymentBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failureReason: "Transfer failed" }) })
    );
  });

  it("on SUCCESS under target: marks the item SUCCESS, allocates to the earliest unpaid entry, bumps the running total, and does not touch ownership", async () => {
    const item = makeBatchItem();
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(item as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue({
      id: "entry-1",
      contractId: "contract-1",
      amountPaid: 0,
      expectedAmount: 8000, // bigger than the 5000 payout, so this stays PARTIALLY_PAID rather than clearing
      status: "DUE",
    } as never);
    prismaMock.investmentContract.update.mockResolvedValue(
      makeContract({ totalPaidToInvestor: 25000 }) as never // 20000 + 5000, still well under the 100000 target
    );
    prismaMock.investorProfile.findUnique.mockResolvedValue({ userId: "user-1" } as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS", transferCode: "trf_2" });

    expect(prismaMock.paymentBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transferStatus: "SUCCESS" }) })
    );
    expect(prismaMock.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduleEntryId: "entry-1", amount: 5000 }) })
    );
    expect(prismaMock.paymentScheduleEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountPaid: 5000, status: "PARTIALLY_PAID" }) })
    );
    expect(prismaMock.ownershipTransfer.create).not.toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", type: "payment_received" })
    );
  });

  it("fully pays off a schedule entry when the amount covers it completely", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem({ amount: 5000 }) as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue({
      id: "entry-1",
      contractId: "contract-1",
      amountPaid: 4000,
      expectedAmount: 9000, // 4000 already paid + this 5000 payout exactly clears it
      status: "PARTIALLY_PAID",
    } as never);
    prismaMock.investmentContract.update.mockResolvedValue(makeContract() as never);
    prismaMock.investorProfile.findUnique.mockResolvedValue(null as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.paymentScheduleEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountPaid: 9000, status: "PAID" }) })
    );
  });

  it("on SUCCESS with no unpaid schedule entry left: still bumps the contract total, allocates nothing", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem() as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    prismaMock.investmentContract.update.mockResolvedValue(makeContract() as never);
    prismaMock.investorProfile.findUnique.mockResolvedValue(null as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.paymentAllocation.create).not.toHaveBeenCalled();
    expect(prismaMock.paymentScheduleEntry.update).not.toHaveBeenCalled();
    expect(prismaMock.investmentContract.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totalPaidToInvestor: { increment: 5000 } } })
    );
  });

  it("on SUCCESS that crosses the target: flips the contract to TARGET_ACHIEVED and opens an OwnershipTransfer to the manager", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem({ amount: 10000 }) as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    // The running total after this payout (95000 + 10000) now meets the
    // 100000 target, this is what recordPayout inspects to decide whether
    // the vehicle just settled.
    prismaMock.investmentContract.update.mockResolvedValueOnce(
      makeContract({ totalPaidToInvestor: 105000, targetPayoutAmount: 100000 }) as never
    );
    prismaMock.investorProfile.findUnique.mockResolvedValue({ userId: "user-1" } as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.investmentContract.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "contract-1" }, data: { status: "TARGET_ACHIEVED" } })
    );
    expect(prismaMock.ownershipTransfer.create).toHaveBeenCalledWith({
      data: {
        contractId: "contract-1",
        vehicleId: "vehicle-1",
        target: "MANAGER",
        status: "TARGET_ACHIEVED",
        fromInvestorId: "investor-1",
      },
    });
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("target payout") })
    );
  });

  it("does not treat a contract that isn't ACTIVE as having just reached target, even if the numbers say so", async () => {
    // A contract that's already TARGET_ACHIEVED, TRANSFER_IN_PROGRESS, or
    // COMPLETED should never open a second OwnershipTransfer just because
    // some late, out-of-order webhook still nudges the running total.
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem() as never);
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    prismaMock.investmentContract.update.mockResolvedValue(
      makeContract({ status: "TARGET_ACHIEVED", totalPaidToInvestor: 105000, targetPayoutAmount: 100000 }) as never
    );
    prismaMock.investorProfile.findUnique.mockResolvedValue(null as never);

    await applyTransferOutcome("item-1", { status: "SUCCESS" });

    expect(prismaMock.ownershipTransfer.create).not.toHaveBeenCalled();
  });
});

describe("applyWalletHold", () => {
  it("is a no-op once the item is already SUCCESS or FAILED", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(makeBatchItem({ transferStatus: "FAILED" }) as never);

    await applyWalletHold("item-1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("credits the investor's wallet by the item amount and records a CREDIT/PAYOUT_HELD transaction", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(
      makeBatchItem({ amount: 5000, payoutDestination: "WALLET" }) as never
    );
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    prismaMock.investmentContract.update.mockResolvedValue(makeContract() as never);
    prismaMock.investorProfile.findUniqueOrThrow.mockResolvedValue({ id: "investor-1", walletBalance: 12000 } as never);
    prismaMock.investorProfile.findUnique.mockResolvedValue({ userId: "user-1" } as never);

    await applyWalletHold("item-1");

    expect(prismaMock.investorProfile.update).toHaveBeenCalledWith({
      where: { id: "investor-1" },
      data: { walletBalance: 17000 }, // 12000 + 5000
    });
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investorId: "investor-1",
          type: "CREDIT",
          source: "PAYOUT_HELD",
          amount: 5000,
          balanceAfter: 17000,
          paymentTransactionId: "pt-1",
        }),
      })
    );
    expect(sendNotificationMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Your wallet just grew" }));
  });

  it("also opens an OwnershipTransfer when a wallet-held payout is the one that crosses the target", async () => {
    prismaMock.paymentBatchItem.findUniqueOrThrow.mockResolvedValue(
      makeBatchItem({ amount: 10000, payoutDestination: "WALLET" }) as never
    );
    prismaMock.paymentTransaction.create.mockResolvedValue({ id: "pt-1" } as never);
    prismaMock.paymentScheduleEntry.findFirst.mockResolvedValue(null);
    prismaMock.investmentContract.update.mockResolvedValueOnce(
      makeContract({ totalPaidToInvestor: 105000, targetPayoutAmount: 100000 }) as never
    );
    prismaMock.investorProfile.findUniqueOrThrow.mockResolvedValue({ id: "investor-1", walletBalance: 0 } as never);
    prismaMock.investorProfile.findUnique.mockResolvedValue({ userId: "user-1" } as never);

    await applyWalletHold("item-1");

    expect(prismaMock.ownershipTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ target: "MANAGER" }) })
    );
  });
});

describe("applyWalletWithdrawalTransferOutcome", () => {
  function makeWithdrawal(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "withdrawal-1",
      investorId: "investor-1",
      amount: 3000,
      status: "APPROVED",
      paystackTransferCode: null,
      failureReason: null,
      ...overrides,
    };
  }

  it("does nothing for a withdrawal that isn't APPROVED (PENDING_APPROVAL, REJECTED, or already PAID)", async () => {
    for (const status of ["PENDING_APPROVAL", "REJECTED", "PAID"]) {
      prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue(makeWithdrawal({ status }) as never);
      await applyWalletWithdrawalTransferOutcome("withdrawal-1", { status: "SUCCESS" });
    }

    expect(prismaMock.walletWithdrawal.update).not.toHaveBeenCalled();
  });

  it("on PENDING: only records the transfer code, does not change status", async () => {
    prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue(makeWithdrawal() as never);

    await applyWalletWithdrawalTransferOutcome("withdrawal-1", { status: "PENDING", transferCode: "trf_3" });

    expect(prismaMock.walletWithdrawal.update).toHaveBeenCalledWith({
      where: { id: "withdrawal-1" },
      data: { paystackTransferCode: "trf_3" },
    });
  });

  it("on SUCCESS: moves an APPROVED withdrawal to PAID and clears any failure reason", async () => {
    prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue(makeWithdrawal() as never);

    await applyWalletWithdrawalTransferOutcome("withdrawal-1", { status: "SUCCESS", transferCode: "trf_4" });

    expect(prismaMock.walletWithdrawal.update).toHaveBeenCalledWith({
      where: { id: "withdrawal-1" },
      data: { status: "PAID", paystackTransferCode: "trf_4", failureReason: null },
    });
  });

  it("on FAILED: stays APPROVED (the wallet debit already happened and is not reversed here) but records why", async () => {
    prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue(makeWithdrawal() as never);

    await applyWalletWithdrawalTransferOutcome("withdrawal-1", { status: "FAILED", failureReason: "Bank rejected transfer" });

    expect(prismaMock.walletWithdrawal.update).toHaveBeenCalledWith({
      where: { id: "withdrawal-1" },
      data: { status: "APPROVED", paystackTransferCode: undefined, failureReason: "Bank rejected transfer" },
    });
  });
});
