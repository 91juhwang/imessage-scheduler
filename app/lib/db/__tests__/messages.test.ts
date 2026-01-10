import { describe, expect, it } from "vitest";
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("messages table", () => {
  it("inserts a queued message with defaults", async () => {
    process.env.GATEWAY_SECRET ||= "test-secret";

    const { createUser } = await import("../models/user.model");
    const { createMessage, getMessageById } = await import("../models/message.model");

    const userId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    await createUser({
      id: userId,
      email: `test-${userId}@example.com`,
      passwordHash: "hash",
      paidUser: false,
      createdAt: new Date(),
    });

    await createMessage({
      id: messageId,
      userId,
      toHandle: "user@example.com",
      body: "hello",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    const row = await getMessageById(messageId);

    expect(row?.status).toBe("QUEUED");
    expect(row?.attemptCount).toBe(0);
  });
});
