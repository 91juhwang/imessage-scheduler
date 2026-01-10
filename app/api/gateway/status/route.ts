import { NextResponse } from "next/server";

import { GatewayStatusCallbackSchema } from "@imessage-scheduler/shared";
import {
  getMessageById,
  type UpdateMessagePatch,
} from "@/app/lib/db/models/message.model";
import { applySend } from "@imessage-scheduler/shared";
import { getRateLimitConfig } from "@/app/lib/rate-limit";
import { getDb } from "@/app/lib/db";
import { messages, userRateLimit, users } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

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

type RateLimitUpdateResult = {
  shouldApply: boolean;
  update: UpdateMessagePatch | null;
};

async function applyRateLimitOnSent(
  db: ReturnType<typeof getDb>,
  message: {
    id: string;
    userId: string;
    receiptCorrelation: Record<string, unknown> | null;
  },
  now: Date,
): Promise<RateLimitUpdateResult> {
  const alreadyApplied = Boolean(message.receiptCorrelation?.rateLimitApplied);
  if (alreadyApplied) {
    return { shouldApply: false, update: null };
  }

  const [userRow] = await db
    .select({ paidUser: users.paidUser })
    .from(users)
    .where(eq(users.id, message.userId))
    .limit(1);
  const paidUser = userRow?.paidUser ?? false;

  const [existingRow] = await db
    .select({
      lastSentAt: userRateLimit.lastSentAt,
      windowStartedAt: userRateLimit.windowStartedAt,
      sentInWindow: userRateLimit.sentInWindow,
    })
    .from(userRateLimit)
    .where(eq(userRateLimit.userId, message.userId))
    .limit(1);

  const rateRow = existingRow ?? {
    lastSentAt: null,
    windowStartedAt: null,
    sentInWindow: 0,
  };
  const config = getRateLimitConfig();
  const nextState = applySend(now, rateRow, paidUser, config);

  if (!existingRow) {
    await db.insert(userRateLimit).values({
      userId: message.userId,
      lastSentAt: nextState.lastSentAt,
      windowStartedAt: nextState.windowStartedAt,
      sentInWindow: nextState.sentInWindow,
    });
  } else {
    await db
      .update(userRateLimit)
      .set({
        lastSentAt: nextState.lastSentAt,
        windowStartedAt: nextState.windowStartedAt,
        sentInWindow: nextState.sentInWindow,
      })
      .where(eq(userRateLimit.userId, message.userId));
  }

  return {
    shouldApply: true,
    update: {
      receiptCorrelation: mergePayload(message.receiptCorrelation, {
        rateLimitApplied: true,
      }),
    },
  };
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
  const shouldApply = shouldApplyStatus(currentStatus, incomingStatus);

  const now = new Date();
  const updates: UpdateMessagePatch = {
    updatedAt: now,
    receiptCorrelation: mergePayload(
      (message.receiptCorrelation as Record<string, unknown> | null) ?? null,
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

  if (shouldApply) {
    updates.status = incomingStatus;
  }

  const applyRateLimit =
    incomingStatus === "SENT" &&
    currentStatus !== "FAILED" &&
    currentStatus !== "CANCELED";

  const db = getDb();
  let didApply = false;

  const rateLimitUpdate = applyRateLimit
    ? await applyRateLimitOnSent(
        db,
        {
          id: message.id,
          userId: message.userId,
          receiptCorrelation:
            (message.receiptCorrelation as Record<string, unknown> | null) ?? null,
        },
        now,
      )
    : { shouldApply: false, update: null };

  if (rateLimitUpdate.update?.receiptCorrelation) {
    updates.receiptCorrelation = mergePayload(
      (updates.receiptCorrelation as Record<string, unknown> | null) ?? null,
      rateLimitUpdate.update.receiptCorrelation,
    );
  }

  await db.transaction(async (tx) => {
    if (!shouldApply && !rateLimitUpdate.shouldApply) {
      return;
    }

    await tx.update(messages).set(updates).where(eq(messages.id, message.id));
    didApply = true;
  });

  return NextResponse.json({ ok: true, ignored: !didApply });
}
