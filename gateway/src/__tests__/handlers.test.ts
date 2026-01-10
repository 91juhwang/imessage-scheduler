import { describe, expect, it } from "vitest";

import type { GatewayEnv } from "../env";
import { handleHealth, handleSend } from "../handlers";

const env: GatewayEnv = {
  gatewaySecret: "secret",
  port: 4001,
  workerEnabled: true,
  version: "0.1.0",
  webBaseUrl: "http://localhost:3000",
  databaseUrl: "mysql://root:root@localhost:3306/test",
  workerPollIntervalMs: 2000,
  maxAttempts: 5,
  baseBackoffSeconds: 30,
  maxBackoffSeconds: 1800,
};

describe("gateway handlers", () => {
  it("rejects unauthorized health calls", () => {
    const result = handleHealth({}, env);
    expect(result.status).toBe(401);
  });

  it("rejects unauthorized send calls", async () => {
    const result = await handleSend({}, { messageId: "x" }, env);
    expect(result.status).toBe(401);
  });

  it("validates send payloads", async () => {
    const result = await handleSend(
      { "x-gateway-secret": "secret" },
      { foo: "bar" },
      env,
    );
    expect(result.status).toBe(400);
  });

  it("accepts valid send payloads", async () => {
    const result = await handleSend(
      { "x-gateway-secret": "secret" },
      { messageId: crypto.randomUUID(), to: "+15551234567", body: "hi" },
      env,
      {
        sendMessage: async () => undefined,
        callback: async () => true,
      },
    );
    expect(result.status).toBe(200);
    expect(result.json.status).toBe("SENT");
  });

  it("reports failed send payloads", async () => {
    const result = await handleSend(
      { "x-gateway-secret": "secret" },
      { messageId: crypto.randomUUID(), to: "+15551234567", body: "hi" },
      env,
      {
        sendMessage: async () => {
          throw new Error("send failed");
        },
        callback: async () => true,
      },
    );
    expect(result.status).toBe(200);
    expect(result.json.status).toBe("FAILED");
  });
});
