import { eq } from "drizzle-orm";

import { getDb } from "../index";
import { userRateLimit } from "../schema";

export type RateLimitRow = {
  userId: string;
  lastSentAt: Date | null;
  windowStartedAt: Date | null;
  sentInWindow: number;
};

export type CreateRateLimitInput = RateLimitRow;
export type UpdateRateLimitPatch = Partial<
  Pick<RateLimitRow, "lastSentAt" | "windowStartedAt" | "sentInWindow">
>;

export async function getRateLimitByUserId(
  userId: string,
): Promise<RateLimitRow | null> {
  const rows = await getDb()
    .select({
      userId: userRateLimit.userId,
      lastSentAt: userRateLimit.lastSentAt,
      windowStartedAt: userRateLimit.windowStartedAt,
      sentInWindow: userRateLimit.sentInWindow,
    })
    .from(userRateLimit)
    .where(eq(userRateLimit.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createRateLimitRow(input: CreateRateLimitInput) {
  await getDb().insert(userRateLimit).values(input);
  return input;
}

export async function getOrCreateRateLimitRow(userId: string) {
  const existing = await getRateLimitByUserId(userId);
  if (existing) {
    return existing;
  }
  const created: RateLimitRow = {
    userId,
    lastSentAt: null,
    windowStartedAt: null,
    sentInWindow: 0,
  };
  await createRateLimitRow(created);
  return created;
}

export async function updateRateLimitByUserId(
  userId: string,
  patch: UpdateRateLimitPatch,
) {
  if (Object.keys(patch).length === 0) {
    return 0;
  }
  const [result] = await getDb()
    .update(userRateLimit)
    .set(patch)
    .where(eq(userRateLimit.userId, userId));
  return result.affectedRows ?? 0;
}
