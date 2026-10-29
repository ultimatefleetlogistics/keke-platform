import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { verifyPaystackSignature } from "@/lib/payments/paystack-client";
import { recordProviderTransaction, processPaystackEvent } from "@/lib/payments/webhook-handler";

/**
 * Single entry point for every Paystack webhook event. Signature is
 * verified against the raw request body before anything is parsed. The
 * event is written to ProviderTransaction (our idempotency guard) before
 * any interpretation happens, and we respond quickly so Paystack does not
 * time out and retry a delivery we already received.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  const providerTransaction = await recordProviderTransaction(payload);

  if (!providerTransaction) {
    // Already processed this exact event, acknowledge and stop.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processPaystackEvent(providerTransaction.id, payload);
  } catch (error) {
    console.error("Failed to process Paystack webhook", { event: payload.event, error });
    // Still return 200: the raw event is safely stored, a failed
    // interpretation should be fixed and replayed from ProviderTransaction,
    // not retried by Paystack indefinitely. Capturing here is what makes
    // that "fixed and replayed" actually happen, this catch deliberately
    // swallows the error so Paystack sees success, which means nothing
    // else surfaces it to anyone unless Sentry does.
    Sentry.captureException(error, {
      contexts: { webhook: { event: payload.event, providerTransactionId: providerTransaction.id } },
    });
  }

  return NextResponse.json({ received: true });
}
