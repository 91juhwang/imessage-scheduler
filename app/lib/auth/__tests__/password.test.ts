import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("hashes and verifies passwords", async () => {
    const password = "test-password";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});
