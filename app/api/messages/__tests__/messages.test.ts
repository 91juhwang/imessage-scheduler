import { describe, expect, it } from "vitest";

import { createSessionRow } from "@/app/lib/db/models/session.model";
import { createUser } from "@/app/lib/db/models/user.model";
import { createMessage, getMessageById } from "@/app/lib/db/models/message.model";
import { createRateLimitRow } from "@/app/lib/db/models/rate_limit.model";
import { SESSION_COOKIE_NAME } from "@/app/lib/auth/cookies";

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.GATEWAY_SECRET ||= "test-secret";

function authCookie(sessionId: string) {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

describe.skipIf(!hasDatabase)("messages api", () => {
  it("creates a message and stores UTC time", async () => {
    const { POST } = await import("@/app/api/messages/route");

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

    const scheduledLocal = "2025-01-01T10:00:00-06:00";

    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(sessionId),
      },
      body: JSON.stringify({
        to_handle: "555-123-4567",
        body: "hello",
        scheduled_for_local: scheduledLocal,
        timezone: "America/Chicago",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const stored = await getMessageById(payload.id);

    expect(stored).not.toBeNull();
    expect(stored?.scheduledForUtc.toISOString()).toBe("2025-01-01T16:00:00.000Z");
  });

  it("lists only messages for the current user", async () => {
    const { GET } = await import("@/app/api/messages/route");

    const userId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    await createUser({
      id: userId,
      email: `test-${userId}@example.com`,
      passwordHash: "hash",
      paidUser: false,
      createdAt: new Date(),
    });

    await createUser({
      id: otherUserId,
      email: `test-${otherUserId}@example.com`,
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

    await createMessage({
      id: crypto.randomUUID(),
      userId,
      toHandle: "+15551234567",
      body: "mine",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    await createMessage({
      id: crypto.randomUUID(),
      userId: otherUserId,
      toHandle: "+15552223333",
      body: "other",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    const request = new Request("http://localhost/api/messages", {
      headers: {
        cookie: authCookie(sessionId),
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].to_handle).toBe("+15551234567");
  });

  it("blocks message creation when rate limit is reached", async () => {
    const { POST } = await import("@/app/api/messages/route");

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
      lastSentAt: new Date(),
      windowStartedAt: new Date(),
      sentInWindow: 2,
    });

    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(sessionId),
      },
      body: JSON.stringify({
        to_handle: "555-123-4567",
        body: "hello",
        scheduled_for_local: "2025-01-01T10:00:00-06:00",
        timezone: "America/Chicago",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });
});
