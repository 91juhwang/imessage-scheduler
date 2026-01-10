import { describe, expect, it } from "vitest";

import { computeBackoffSeconds, isLockAcquired, sortByFifo } from "../worker";

describe("worker helpers", () => {
  it("caps exponential backoff at 30 minutes", () => {
    expect(computeBackoffSeconds(1, 30, 1800)).toBe(30);
    expect(computeBackoffSeconds(2, 30, 1800)).toBe(60);
    expect(computeBackoffSeconds(3, 30, 1800)).toBe(120);
    expect(computeBackoffSeconds(10, 30, 1800)).toBe(1800);
  });

  it("detects lock acquisition by affected rows", () => {
    expect(isLockAcquired(1)).toBe(true);
    expect(isLockAcquired(0)).toBe(false);
  });

  it("orders messages by scheduled_for_utc then created_at", () => {
    const rows = [
      {
        id: "b",
        toHandle: "+1555",
        body: "b",
        scheduledForUtc: new Date("2025-01-02T10:00:00.000Z"),
        attemptCount: 0,
        createdAt: new Date("2025-01-01T09:00:00.000Z"),
      },
      {
        id: "a",
        toHandle: "+1555",
        body: "a",
        scheduledForUtc: new Date("2025-01-01T10:00:00.000Z"),
        attemptCount: 0,
        createdAt: new Date("2025-01-01T08:00:00.000Z"),
      },
      {
        id: "c",
        toHandle: "+1555",
        body: "c",
        scheduledForUtc: new Date("2025-01-01T10:00:00.000Z"),
        attemptCount: 0,
        createdAt: new Date("2025-01-01T09:30:00.000Z"),
      },
    ];

    const sorted = sortByFifo(rows);
    expect(sorted[0]?.id).toBe("a");
    expect(sorted[1]?.id).toBe("c");
    expect(sorted[2]?.id).toBe("b");
  });
});
