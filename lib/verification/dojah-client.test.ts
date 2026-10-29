import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { isDojahConfigured, lookupBvn, lookupNin, namesReasonablyMatch } from "@/lib/verification/dojah-client";

describe("isDojahConfigured", () => {
  afterEach(() => {
    delete process.env.DOJAH_APP_ID;
    delete process.env.DOJAH_API_KEY;
  });

  it("is false when neither environment variable is set", () => {
    expect(isDojahConfigured()).toBe(false);
  });

  it("is false when only one of the two is set", () => {
    process.env.DOJAH_APP_ID = "app-id";
    expect(isDojahConfigured()).toBe(false);
  });

  it("is true once both are set", () => {
    process.env.DOJAH_APP_ID = "app-id";
    process.env.DOJAH_API_KEY = "secret-key";
    expect(isDojahConfigured()).toBe(true);
  });
});

describe("lookupBvn / lookupNin", () => {
  beforeEach(() => {
    process.env.DOJAH_APP_ID = "app-id";
    process.env.DOJAH_API_KEY = "secret-key";
  });

  afterEach(() => {
    delete process.env.DOJAH_APP_ID;
    delete process.env.DOJAH_API_KEY;
    delete process.env.DOJAH_ENVIRONMENT;
    vi.unstubAllGlobals();
  });

  it("returns an error result without calling fetch when not configured", async () => {
    delete process.env.DOJAH_APP_ID;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await lookupBvn("22134587690");

    expect(result.outcome).toBe("error");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests the sandbox host by default, with the documented headers and query param", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entity: { bvn: "221***4567", first_name: "JOHN", last_name: "MUSA" } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await lookupBvn("22134587690");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://sandbox.dojah.io/api/v1/kyc/bvn/full?bvn=22134587690");
    expect(options.method).toBe("GET");
    // No "Bearer " prefix, unlike Paystack's client, see the client's own
    // comment for why: this is Dojah's actual documented header shape.
    expect(options.headers.Authorization).toBe("secret-key");
    expect(options.headers.AppId).toBe("app-id");
  });

  it("requests the live host once DOJAH_ENVIRONMENT=live is set", async () => {
    process.env.DOJAH_ENVIRONMENT = "live";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entity: { first_name: "JOHN", last_name: "MUSA" } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await lookupNin("98213456701");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.dojah.io/api/v1/kyc/nin?nin=98213456701");
  });

  it("returns the entity on a successful response", async () => {
    const entity = { first_name: "JOHN", last_name: "MUSA", middle_name: "DOE" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entity }) })
    );

    const result = await lookupNin("98213456701");

    expect(result).toEqual({ outcome: "found", entity });
  });

  it("treats a 404 as not_found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));

    const result = await lookupBvn("00000000000");

    expect(result).toEqual({ outcome: "not_found" });
  });

  it("treats a response with no entity field as not_found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));

    const result = await lookupBvn("22134587690");

    expect(result).toEqual({ outcome: "not_found" });
  });

  it("treats any other non-ok status as an error, not a mismatch or not_found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));

    const result = await lookupBvn("22134587690");

    expect(result.outcome).toBe("error");
  });

  it("returns an error result rather than throwing when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await lookupBvn("22134587690");

    expect(result).toEqual({ outcome: "error", message: "network down" });
  });
});

describe("namesReasonablyMatch", () => {
  it("matches when first and last name both appear in the stated name, same order", () => {
    expect(namesReasonablyMatch("John Musa", { first_name: "JOHN", last_name: "MUSA" })).toBe(true);
  });

  it("matches regardless of case", () => {
    expect(namesReasonablyMatch("john musa", { first_name: "JOHN", last_name: "MUSA" })).toBe(true);
  });

  it("matches when the stated name includes a middle name Dojah didn't return", () => {
    expect(namesReasonablyMatch("John Doe Musa", { first_name: "JOHN", last_name: "MUSA" })).toBe(true);
  });

  it("matches regardless of word order", () => {
    expect(namesReasonablyMatch("Musa John", { first_name: "JOHN", last_name: "MUSA" })).toBe(true);
  });

  it("does not match when the last name is missing entirely", () => {
    expect(namesReasonablyMatch("John Okafor", { first_name: "JOHN", last_name: "MUSA" })).toBe(false);
  });

  it("does not match when neither name appears, an entirely different person", () => {
    expect(namesReasonablyMatch("Amaka Chukwu", { first_name: "JOHN", last_name: "MUSA" })).toBe(false);
  });

  it("does not match an empty stated name", () => {
    expect(namesReasonablyMatch("", { first_name: "JOHN", last_name: "MUSA" })).toBe(false);
  });
});
