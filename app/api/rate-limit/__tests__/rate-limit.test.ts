import { describe, expect, it } from "vitest";

import { createRateLimitRow } from "@/app/lib/db/models/rate_limit.model";
import { createSessionRow } from "@/app/lib/db/models/session.model";
import { createUser } from "@/app/lib/db/models/user.model";
import { SESSION_COOKIE_NAME } from "@/app/lib/auth/cookies";

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.GATEWAY_SECRET ||= "test-secret";

function authCookie(sessionId: string) {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

describe.skipIf(!hasDatabase)("rate limit api", () => {
  it("returns remaining sends for the user", async () => {
    const { GET } = await import("@/app/api/rate-limit/route");

    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    await createUser({
      id: userId,
      email: `test-${userId}@example.com`,
      passwordHash: "hash",
      paidUser: false,
      createdAt: new Date(),
    });

    await createSessionRow({
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    await createRateLimitRow({
      userId,
      lastSentAt: null,
      windowStartedAt: new Date(),
      sentInWindow: 1,
    });

    process.env.FREE_MAX_PER_HOUR = "2";
    process.env.FREE_MIN_INTERVAL_SECONDS = "0";

    const request = new Request("http://localhost/api/rate-limit", {
      headers: {
        cookie: authCookie(sessionId),
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.remaining_in_window).toBe(1);
    expect(payload.max_per_hour).toBe(2);
  });
});
