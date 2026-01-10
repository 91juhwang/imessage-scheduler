import { GatewaySendRequestSchema, GatewayStatusCallbackSchema } from "@imessage-scheduler/shared";

import type { GatewayEnv } from "./env";
import { sendIMessage } from "./applescript";
import { postGatewayStatus } from "./callback";

// pure http handlers
type HandlerResult = {
  status: number;
  json: Record<string, unknown>;
};

type SendDependencies = {
  sendMessage?: (to: string, body: string) => Promise<void>;
  callback?: (payload: unknown) => Promise<boolean>;
};

function readHeader(headers: Record<string, string | string[] | undefined>, name: string) {
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  const value = match?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorized(headers: Record<string, string | string[] | undefined>, env: GatewayEnv) {
  const provided = readHeader(headers, "x-gateway-secret");
  return Boolean(provided && provided === env.gatewaySecret);
}

function handleHealth(
  headers: Record<string, string | string[] | undefined>,
  env: GatewayEnv,
): HandlerResult {
  if (!isAuthorized(headers, env)) {
    return { status: 401, json: { error: "unauthorized" } };
  }

  return {
    status: 200,
    json: {
      ok: true,
      timestamp: new Date().toISOString(),
      workerEnabled: env.workerEnabled,
      version: env.version,
    },
  };
}

async function handleSend(
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
  env: GatewayEnv,
  deps: SendDependencies = {},
): Promise<HandlerResult> {
  if (!isAuthorized(headers, env)) {
    return { status: 401, json: { error: "unauthorized" } };
  }

  const parsed = GatewaySendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, json: { error: "invalid_input" } };
  }

  const sendMessage = deps.sendMessage ?? sendIMessage;
  const callback =
    deps.callback ??
    ((payload: unknown) => {
      const validated = GatewayStatusCallbackSchema.parse(payload);
      return postGatewayStatus(validated, env);
    });

  try {
    await sendMessage(parsed.data.to, parsed.data.body);
    const payload = {
      messageId: parsed.data.messageId,
      status: "SENT",
      payload: {
        sendMethod: "applescript",
        sentAt: new Date().toISOString(),
      },
    };
    await callback(payload);
    return {
      status: 200,
      json: {
        status: "SENT",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const payload = {
      messageId: parsed.data.messageId,
      status: "FAILED",
      payload: {
        sendMethod: "applescript",
        error: message,
      },
    };
    await callback(payload);
    return {
      status: 200,
      json: {
        status: "FAILED",
        error: message,
      },
    };
  }
}

export { handleHealth, handleSend };
