import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("messages table", () => {
  it("inserts a queued message with defaults", async () => {
    process.env.GATEWAY_SECRET ||= "test-secret";

    const { db } = await import("../index");
    const { messages, users } = await import("../schema");

    const userId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email: `test-${userId}@example.com`,
      passwordHash: "hash",
      paidUser: false,
      createdAt: new Date(),
    });

    await db.insert(messages).values({
      id: messageId,
      userId,
      toHandle: "user@example.com",
      body: "hello",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    const row = await db
      .select({
        status: messages.status,
        attemptCount: messages.attemptCount,
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    expect(row[0]?.status).toBe("QUEUED");
    expect(row[0]?.attemptCount).toBe(0);
  });
});
