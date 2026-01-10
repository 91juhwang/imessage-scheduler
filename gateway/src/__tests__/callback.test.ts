import { describe, expect, it } from "vitest";

import { postGatewayStatus } from "../callback";
import type { GatewayEnv } from "../env";

describe("postGatewayStatus", () => {
  it("sends payload with gateway secret", async () => {
    const env: GatewayEnv = {
      gatewaySecret: "secret",
      port: 4001,
      workerEnabled: true,
      version: "0.1.0",
      webBaseUrl: "http://localhost:3000",
    };

    let capturedHeaders: Record<string, string> | null = null;
    let capturedBody: string | null = null;

    const ok = await postGatewayStatus(
      {
        messageId: crypto.randomUUID(),
        status: "SENT",
      },
      env,
      async ({ headers, body }) => {
        capturedHeaders = headers;
        capturedBody = body;
        return { status: 200 };
      },
    );

    expect(ok).toBe(true);
    expect(capturedHeaders?.["X-Gateway-Secret"]).toBe("secret");
    expect(capturedBody).toContain("\"status\":\"SENT\"");
  });
});
