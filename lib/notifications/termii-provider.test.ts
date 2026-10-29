import { describe, it, expect } from "vitest";

import { toTermiiPhoneFormat } from "@/lib/notifications/termii-provider";

describe("toTermiiPhoneFormat", () => {
  it("converts a local 0-prefixed number to the 234 country code", () => {
    expect(toTermiiPhoneFormat("08012345678")).toBe("2348012345678");
  });

  it("strips spaces and dashes before converting", () => {
    expect(toTermiiPhoneFormat("080 123 45678")).toBe("2348012345678");
    expect(toTermiiPhoneFormat("0801-234-5678")).toBe("2348012345678");
  });

  it("strips a leading + from a number already in international format", () => {
    expect(toTermiiPhoneFormat("+2348012345678")).toBe("2348012345678");
  });

  it("passes a number already starting with a country code through unchanged", () => {
    expect(toTermiiPhoneFormat("2348012345678")).toBe("2348012345678");
  });

  it("passes a non-Nigerian international number through rather than guessing", () => {
    // Cannot tell a foreign number was intentional versus a mistyped local
    // one, see the doc comment on toTermiiPhoneFormat, so no "0" handling
    // applies to a number that does not start with 0.
    expect(toTermiiPhoneFormat("+14155552671")).toBe("14155552671");
  });
});
