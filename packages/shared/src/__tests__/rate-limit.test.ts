import { describe, expect, it } from "vitest";

import { applySend, evaluateRateLimit } from "../rate-limit";

const config = {
  free: { minIntervalSeconds: 0, maxPerHour: 2 },
  paid: { minIntervalSeconds: 0, maxPerHour: 30 },
};

describe("rate-limit helpers", () => {
  it("allows free users up to max per hour", () => {
    const now = new Date("2025-01-01T10:00:00.000Z");
    const row = { lastSentAt: null, windowStartedAt: null, sentInWindow: 0 };

    const decision1 = evaluateRateLimit(now, row, false, config);
    expect(decision1.allowed).toBe(true);

    const afterSend1 = applySend(now, row, false, config);
    const decision2 = evaluateRateLimit(now, afterSend1, false, config);
    expect(decision2.allowed).toBe(true);

    const afterSend2 = applySend(now, afterSend1, false, config);
    const decision3 = evaluateRateLimit(now, afterSend2, false, config);
    expect(decision3.allowed).toBe(false);
    expect(decision3.reason).toBe("MAX_PER_HOUR");
  });

  it("allows paid users more per hour", () => {
    const now = new Date("2025-01-01T10:00:00.000Z");
    const row = {
      lastSentAt: new Date("2025-01-01T10:00:00.000Z"),
      windowStartedAt: new Date("2025-01-01T10:00:00.000Z"),
      sentInWindow: 29,
    };

    const decision = evaluateRateLimit(now, row, true, config);
    expect(decision.allowed).toBe(true);

    const afterSend = applySend(now, row, true, config);
    const decision2 = evaluateRateLimit(now, afterSend, true, config);
    expect(decision2.allowed).toBe(false);
    expect(decision2.reason).toBe("MAX_PER_HOUR");
  });

  it("resets the window after an hour", () => {
    const now = new Date("2025-01-01T11:01:00.000Z");
    const row = {
      lastSentAt: new Date("2025-01-01T10:00:00.000Z"),
      windowStartedAt: new Date("2025-01-01T10:00:00.000Z"),
      sentInWindow: 2,
    };

    const decision = evaluateRateLimit(now, row, false, config);
    expect(decision.allowed).toBe(true);
    expect(decision.normalized.sentInWindow).toBe(0);
  });
});
