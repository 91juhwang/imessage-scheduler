import { describe, expect, it } from "vitest";

import { formatUsPhoneDigits, normalizeUsPhone } from "../phone";

describe("normalizeUsPhone", () => {
  it("normalizes common US formats", () => {
    expect(normalizeUsPhone("5551234567")?.formatted).toBe("555-123-4567");
    expect(normalizeUsPhone("(555) 123-4567")?.formatted).toBe("555-123-4567");
    expect(normalizeUsPhone("+1 555 123 4567")?.formatted).toBe("555-123-4567");
    expect(normalizeUsPhone("5551234567")?.e164).toBe("+15551234567");
  });

  it("rejects invalid phone numbers", () => {
    expect(normalizeUsPhone("123")).toBeNull();
    expect(normalizeUsPhone("55512345678")).toBeNull();
  });

  it("formats partial digit input", () => {
    expect(formatUsPhoneDigits("5")).toBe("5");
    expect(formatUsPhoneDigits("5551")).toBe("555-1");
    expect(formatUsPhoneDigits("555123")).toBe("555-123");
    expect(formatUsPhoneDigits("5551234")).toBe("555-123-4");
    expect(formatUsPhoneDigits("5551234567")).toBe("555-123-4567");
  });
});
