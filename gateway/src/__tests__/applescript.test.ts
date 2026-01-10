import { describe, expect, it } from "vitest";

import { buildAppleScript } from "../applescript";

describe("buildAppleScript", () => {
  it("escapes input and constructs a message script", () => {
    const script = buildAppleScript('+15551234567', 'Hello "world"');
    expect(script).toContain('buddy "+15551234567"');
    expect(script).toContain('send "Hello \\"world\\""');
  });
});
