import {
  evaluateRateLimit,
  type RateLimitConfig,
  type RateLimitDecision,
} from "@imessage-scheduler/shared";

import type { RateLimitRow } from "./db/models/rate_limit.model";

type RateLimitSummary = {
  remainingInWindow: number;
  maxPerHour: number;
  nextAllowedAt: Date | null;
};

function getRateLimitConfig(): RateLimitConfig {
  const freeMinIntervalSeconds = Number(process.env.FREE_MIN_INTERVAL_SECONDS ?? 0);
  const paidMinIntervalSeconds = Number(process.env.PAID_MIN_INTERVAL_SECONDS ?? 0);
  const freeMaxPerHour = Number(process.env.FREE_MAX_PER_HOUR ?? 2);
  const paidMaxPerHour = Number(process.env.PAID_MAX_PER_HOUR ?? 30);

  return {
    free: { minIntervalSeconds: freeMinIntervalSeconds, maxPerHour: freeMaxPerHour },
    paid: { minIntervalSeconds: paidMinIntervalSeconds, maxPerHour: paidMaxPerHour },
  };
}

function buildRateLimitSummary(
  now: Date,
  row: RateLimitRow,
  paidUser: boolean,
) : RateLimitSummary {
  const config = getRateLimitConfig();
  const decision = evaluateRateLimit(now, row, paidUser, config);
  const maxPerHour = paidUser ? config.paid.maxPerHour : config.free.maxPerHour;
  return {
    remainingInWindow: decision.remainingInWindow,
    maxPerHour,
    nextAllowedAt: decision.nextAllowedAt,
  };
}

export type { RateLimitSummary };
function getRateLimitDecision(
  now: Date,
  row: RateLimitRow,
  paidUser: boolean,
): RateLimitDecision {
  const config = getRateLimitConfig();
  return evaluateRateLimit(now, row, paidUser, config);
}

export { buildRateLimitSummary, getRateLimitConfig, getRateLimitDecision };
