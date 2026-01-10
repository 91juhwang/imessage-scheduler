type RateLimitRow = {
  lastSentAt: Date | null;
  windowStartedAt: Date | null;
  sentInWindow: number;
};

type RateLimitLimits = {
  minIntervalSeconds: number;
  maxPerHour: number;
};

type RateLimitConfig = {
  free: RateLimitLimits;
  paid: RateLimitLimits;
};

type RateLimitDecision = {
  allowed: boolean;
  reason: "MIN_INTERVAL" | "MAX_PER_HOUR" | null;
  nextAllowedAt: Date | null;
  remainingInWindow: number;
  normalized: RateLimitRow;
};

function normalizeWindow(now: Date, row: RateLimitRow) {
  if (!row.windowStartedAt) {
    return { ...row, windowStartedAt: now, sentInWindow: 0 };
  }
  const windowEnd = row.windowStartedAt.getTime() + 60 * 60 * 1000;
  if (now.getTime() >= windowEnd) {
    return { ...row, windowStartedAt: now, sentInWindow: 0 };
  }
  return row;
}

function getLimits(config: RateLimitConfig, paidUser: boolean) {
  return paidUser ? config.paid : config.free;
}

function evaluateRateLimit(
  now: Date,
  row: RateLimitRow,
  paidUser: boolean,
  config: RateLimitConfig,
): RateLimitDecision {
  const limits = getLimits(config, paidUser);
  const normalized = normalizeWindow(now, row);

  if (limits.minIntervalSeconds > 0 && normalized.lastSentAt) {
    const earliest =
      normalized.lastSentAt.getTime() + limits.minIntervalSeconds * 1000;
    if (now.getTime() < earliest) {
      return {
        allowed: false,
        reason: "MIN_INTERVAL",
        nextAllowedAt: new Date(earliest),
        remainingInWindow: Math.max(limits.maxPerHour - normalized.sentInWindow, 0),
        normalized,
      };
    }
  }

  if (normalized.sentInWindow >= limits.maxPerHour) {
    const nextAllowed =
      normalized.windowStartedAt
        ? new Date(normalized.windowStartedAt.getTime() + 60 * 60 * 1000)
        : null;
    return {
      allowed: false,
      reason: "MAX_PER_HOUR",
      nextAllowedAt: nextAllowed,
      remainingInWindow: 0,
      normalized,
    };
  }

  return {
    allowed: true,
    reason: null,
    nextAllowedAt: null,
    remainingInWindow: Math.max(limits.maxPerHour - normalized.sentInWindow, 0),
    normalized,
  };
}

function applySend(
  now: Date,
  row: RateLimitRow,
  paidUser: boolean,
  config: RateLimitConfig,
) {
  const limits = getLimits(config, paidUser);
  const normalized = normalizeWindow(now, row);
  return {
    lastSentAt: now,
    windowStartedAt: normalized.windowStartedAt ?? now,
    sentInWindow: normalized.sentInWindow + 1,
    remainingInWindow: Math.max(limits.maxPerHour - normalized.sentInWindow - 1, 0),
  };
}

export type { RateLimitConfig, RateLimitDecision, RateLimitRow };
export { applySend, evaluateRateLimit, normalizeWindow };
