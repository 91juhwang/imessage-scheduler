import { describe, expect, it } from "vitest";

import { createMessage, getMessageById, updateMessageById } from "@/app/lib/db/models/message.model";
import { createUser } from "@/app/lib/db/models/user.model";

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.GATEWAY_SECRET ||= "test-secret";

function gatewayHeaders(secret = process.env.GATEWAY_SECRET ?? "") {
  return { "X-Gateway-Secret": secret, "content-type": "application/json" };
}

describe.skipIf(!hasDatabase)("gateway status callback", () => {
  it("rejects invalid secret", async () => {
    const { POST } = await import("@/app/api/gateway/status/route");

    const request = new Request("http://localhost/api/gateway/status", {
      method: "POST",
      headers: gatewayHeaders("wrong-secret"),
      body: JSON.stringify({
        messageId: crypto.randomUUID(),
        status: "SENT",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("updates status and timestamps", async () => {
    const { POST } = await import("@/app/api/gateway/status/route");

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
      toHandle: "+15551234567",
      body: "hello",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    const sentRequest = new Request("http://localhost/api/gateway/status", {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        messageId,
        status: "SENT",
        payload: { gatewayMessageId: "gw-1" },
      }),
    });

    const sentResponse = await POST(sentRequest);
    expect(sentResponse.status).toBe(200);

    const deliveredRequest = new Request("http://localhost/api/gateway/status", {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        messageId,
        status: "DELIVERED",
        payload: { delivered: true },
      }),
    });

    const deliveredResponse = await POST(deliveredRequest);
    expect(deliveredResponse.status).toBe(200);

    const updated = await getMessageById(messageId);
    expect(updated?.status).toBe("DELIVERED");
    expect(updated?.deliveredAt).toBeInstanceOf(Date);
    expect(updated?.receiptCorrelation).toMatchObject({
      gatewayMessageId: "gw-1",
      delivered: true,
    });
  });

  it("does not downgrade status", async () => {
    const { POST } = await import("@/app/api/gateway/status/route");

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
      toHandle: "+15551234567",
      body: "hello",
      scheduledForUtc: new Date(),
      timezone: "UTC",
    });

    await updateMessageById(messageId, {
      status: "DELIVERED",
      deliveredAt: new Date(),
      updatedAt: new Date(),
    });

    const sentRequest = new Request("http://localhost/api/gateway/status", {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        messageId,
        status: "SENT",
      }),
    });

    const response = await POST(sentRequest);
    expect(response.status).toBe(200);

    const updated = await getMessageById(messageId);
    expect(updated?.status).toBe("DELIVERED");
  });
});
