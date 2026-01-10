import { describe, expect, it } from "vitest";

import {
  SLOT_LABELS,
  SLOT_MINUTES,
  formatDateLabel,
  formatDateTimeInputValue,
  formatIsoWithOffset,
  parseDateTimeInputValue,
} from "../timeline-helpers";
import { addDays, formatDateKey, parseDateKey, startOfDay } from "@/app/lib/date-utils";

function formatOffsetForDate(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

describe("timeline-helpers", () => {
  it("builds slot labels for 30 minute increments", () => {
    expect(SLOT_MINUTES).toBe(30);
    expect(SLOT_LABELS).toHaveLength(48);
    expect(SLOT_LABELS[0]).toBe("12:00 AM");
    expect(SLOT_LABELS[1]).toBe("12:30 AM");
  });

  it("normalizes dates to start of day", () => {
    const date = new Date(2025, 0, 5, 14, 45, 30);
    const start = startOfDay(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("adds days without mutating the original date", () => {
    const date = new Date(2025, 0, 5, 10, 0, 0);
    const next = addDays(date, 2);
    expect(next.getDate()).toBe(7);
    expect(date.getDate()).toBe(5);
  });

  it("formats labels with consistent locale output", () => {
    const date = new Date(2025, 0, 5);
    expect(formatDateLabel(date)).toBe("Sunday, Jan 5");
  });

  it("formats and parses date keys", () => {
    const date = new Date(2025, 0, 5, 12, 0, 0);
    const key = formatDateKey(date);
    const parsed = parseDateKey(key);

    expect(key).toBe("2025-01-05");
    expect(parsed?.getFullYear()).toBe(2025);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(5);
  });

  it("round-trips datetime-local values", () => {
    const date = new Date(2025, 0, 5, 9, 15, 0, 0);
    const formatted = formatDateTimeInputValue(date);
    const parsed = parseDateTimeInputValue(formatted);

    expect(formatted).toBe("2025-01-05T09:15");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2025);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(5);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(15);
  });

  it("formats ISO strings with local offset", () => {
    const date = new Date(2025, 0, 5, 9, 15, 0, 0);
    const formatted = formatIsoWithOffset(date);
    const offset = formatOffsetForDate(date);

    expect(formatted).toBe(`2025-01-05T09:15:00${offset}`);
  });
});
