import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { verifyPaystackSignature, koboToNaira, nairaToKobo } from "@/lib/payments/paystack-client";

describe("koboToNaira / nairaToKobo", () => {
  it("converts kobo to naira", () => {
    expect(koboToNaira(150000)).toBe(1500);
  });

  it("converts naira to kobo", () => {
    expect(nairaToKobo(1500)).toBe(150000);
  });

  it("round-trips without drift for a typical amount", () => {
    expect(koboToNaira(nairaToKobo(24999.5))).toBe(24999.5);
  });

  it("rounds nairaToKobo to the nearest whole kobo", () => {
    // Naira amounts here never carry more than 2 decimal places in
    // practice, but the conversion itself should still round cleanly
    // rather than produce a fractional kobo value.
    expect(nairaToKobo(10.005)).toBe(1001);
  });
});

describe("verifyPaystackSignature", () => {
  const secret = "sk_test_verify_signature_suite";

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = secret;
  });

  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  function signatureFor(body: string): string {
    return crypto.createHmac("sha512", secret).update(body).digest("hex");
  }

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123" } });
    expect(verifyPaystackSignature(body, signatureFor(body))).toBe(true);
  });

  it("rejects a body whose signature does not match", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123" } });
    const wrongSignature = signatureFor(JSON.stringify({ event: "charge.success", data: { reference: "different" } }));
    expect(verifyPaystackSignature(body, wrongSignature)).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(verifyPaystackSignature("{}", null)).toBe(false);
  });

  it("rejects, rather than throws, a malformed signature header of the wrong length", () => {
    // crypto.timingSafeEqual throws RangeError on a buffer length
    // mismatch, verifyPaystackSignature must check length itself first,
    // an attacker (or a broken client) can send any garbage here and the
    // webhook route must still get a clean false, not a 500.
    expect(() => verifyPaystackSignature("{}", "not-a-real-signature")).not.toThrow();
    expect(verifyPaystackSignature("{}", "not-a-real-signature")).toBe(false);
  });

  it("rejects an empty string signature header", () => {
    expect(verifyPaystackSignature("{}", "")).toBe(false);
  });

  it("is sensitive to any change in the body, even a single character", () => {
    const body = "same-prefix-a";
    const otherBody = "same-prefix-b";
    const signature = signatureFor(body);
    expect(verifyPaystackSignature(otherBody, signature)).toBe(false);
  });
});
