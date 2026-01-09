import { describe, expect, it } from "vitest";

import { hashBody } from "../crypto";

describe("hashBody", () => {
  it("returns deterministic sha256 hex", () => {
    const first = hashBody("hello world");
    const second = hashBody("hello world");

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
