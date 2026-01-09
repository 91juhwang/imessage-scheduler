import { describe, expect, it } from "vitest";

import {
  CreateMessageInputSchema,
  LoginInputSchema,
} from "../schemas";

const validPayload = {
  to_handle: "user@example.com",
  body: "Hello",
  scheduled_for_local: new Date().toISOString(),
  timezone: "America/Chicago",
};

describe("schemas", () => {
  it("accepts valid timezone", () => {
    const result = CreateMessageInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects invalid timezone", () => {
    const result = CreateMessageInputSchema.safeParse({
      ...validPayload,
      timezone: "Mars/Phobos",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing to/body", () => {
    const noTo = CreateMessageInputSchema.safeParse({
      ...validPayload,
      to_handle: "",
    });
    const noBody = CreateMessageInputSchema.safeParse({
      ...validPayload,
      body: "",
    });

    expect(noTo.success).toBe(false);
    expect(noBody.success).toBe(false);
  });

  it("validates login input", () => {
    const ok = LoginInputSchema.safeParse({
      email: "user@example.com",
      password: "password",
    });
    const bad = LoginInputSchema.safeParse({
      email: "not-an-email",
      password: "",
    });

    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });
});
