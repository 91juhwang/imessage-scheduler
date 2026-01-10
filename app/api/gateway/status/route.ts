import { NextResponse } from "next/server";

import { GatewayStatusCallbackSchema } from "@imessage-scheduler/shared";
import {
  getMessageById,
  type UpdateMessagePatch,
  updateMessageById,
} from "@/app/lib/db/models/message.model";

const STATUS_ORDER = {
  QUEUED: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  RECEIVED: 4,
  FAILED: 5,
  CANCELED: 5,
} as const;

type StatusKey = keyof typeof STATUS_ORDER;

type StatusPayload = Record<string, unknown> | undefined;

// receiptCorrelation payload merger --> for any additional data from gateway
function mergePayload(
  existing: Record<string, unknown> | null,
  payload: StatusPayload,
) {
  if (!payload) {
    return existing;
  }
  return { ...(existing ?? {}), ...payload };
}

function shouldApplyStatus(current: StatusKey, incoming: StatusKey) {
  if (current === "FAILED" || current === "CANCELED") {
    return false;
  }

  if (incoming === "FAILED") {
    return !(current === "DELIVERED" || current === "RECEIVED");
  }

  if (incoming === "SENT" || incoming === "DELIVERED" || incoming === "RECEIVED") {
    return STATUS_ORDER[incoming] > STATUS_ORDER[current];
  }

  return false;
}

function readGatewaySecret(request: Request) {
  return request.headers.get("X-Gateway-Secret");
}

export async function POST(request: Request) {
  const gatewaySecret = process.env.GATEWAY_SECRET;
  if (!gatewaySecret) {
    return NextResponse.json({ error: "missing_secret" }, { status: 500 });
  }

  const providedSecret = readGatewaySecret(request);
  if (!providedSecret || providedSecret !== gatewaySecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = GatewayStatusCallbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const message = await getMessageById(parsed.data.messageId);
  if (!message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const incomingStatus = parsed.data.status as StatusKey;
  const currentStatus = message.status as StatusKey;

  if (!shouldApplyStatus(currentStatus, incomingStatus)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const now = new Date();
  const updates: UpdateMessagePatch = {
    status: incomingStatus,
    updatedAt: now,
    receiptCorrelation: mergePayload(
      message.receiptCorrelation,
      parsed.data.payload,
    ),
  };

  if (incomingStatus === "DELIVERED") {
    updates.deliveredAt = now;
  }

  if (incomingStatus === "RECEIVED") {
    updates.receivedAt = now;
  }

  if (incomingStatus === "FAILED") {
    const errorPayload = parsed.data.payload?.error;
    updates.lastError = typeof errorPayload === "string" ? errorPayload : null;
  }

  await updateMessageById(message.id, updates);

  return NextResponse.json({ ok: true });
}
