import { describe, expect, it } from "vitest";

import { createSessionRow } from "@/app/lib/db/models/session.model";
import { createUser } from "@/app/lib/db/models/user.model";
import {
  createMessage,
  getMessageById,
  updateMessageById,
} from "@/app/lib/db/models/message.model";
import { SESSION_COOKIE_NAME } from "@/app/lib/auth/cookies";

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.GATEWAY_SECRET ||= "test-secret";

function authCookie(sessionId: string) {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

describe.skipIf(!hasDatabase)("messages update api", () => {
  it("updates queued message", async () => {
    const { PATCH } = await import("@/app/api/messages/[id]/route");

    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

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

    await createMessage({
      id: messageId,
      userId,
      toHandle: "+15551234567",
      body: "hello",
      scheduledForUtc: new Date("2025-01-01T16:00:00.000Z"),
      timezone: "UTC",
    });

    const request = new Request(`http://localhost/api/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(sessionId),
      },
      body: JSON.stringify({
        to_handle: "555-987-6543",
        body: "updated",
        scheduled_for_local: "2025-01-02T10:00:00-06:00",
        timezone: "America/Chicago",
      }),
    });

    const response = await PATCH(request, { params: { id: messageId } });
    expect(response.status).toBe(200);

    const updated = await getMessageById(messageId);
    expect(updated?.toHandle).toBe("+15559876543");
    expect(updated?.body).toBe("updated");
    expect(updated?.scheduledForUtc.toISOString()).toBe("2025-01-02T16:00:00.000Z");
  });

  it("blocks updates to sent messages", async () => {
    const { PATCH } = await import("@/app/api/messages/[id]/route");

    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

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

    await createMessage({
      id: messageId,
      userId,
      toHandle: "+15551234567",
      body: "hello",
      scheduledForUtc: new Date("2025-01-01T16:00:00.000Z"),
      timezone: "UTC",
    });

    await updateMessageById(messageId, { status: "SENT", updatedAt: new Date() });

    const request = new Request(`http://localhost/api/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: authCookie(sessionId),
      },
      body: JSON.stringify({
        to_handle: "555-987-6543",
      }),
    });

    const response = await PATCH(request, { params: { id: messageId } });
    expect(response.status).toBe(409);
  });

  it("cancels queued messages", async () => {
    const { POST } = await import("@/app/api/messages/[id]/cancel/route");

    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

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

    await createMessage({
      id: messageId,
      userId,
      toHandle: "+15551234567",
      body: "hello",
      scheduledForUtc: new Date("2025-01-01T16:00:00.000Z"),
      timezone: "UTC",
    });

    const request = new Request(
      `http://localhost/api/messages/${messageId}/cancel`,
      {
        method: "POST",
        headers: {
          cookie: authCookie(sessionId),
        },
      },
    );

    const response = await POST(request, { params: { id: messageId } });
    expect(response.status).toBe(200);

    const canceled = await getMessageById(messageId);
    expect(canceled?.status).toBe("CANCELED");
  });
});
