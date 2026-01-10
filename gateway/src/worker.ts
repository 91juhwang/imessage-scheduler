import { and, asc, eq, isNull, lte } from "drizzle-orm";

import { GatewayStatusCallbackSchema } from "@imessage-scheduler/shared";

import type { GatewayEnv } from "./env";
import { sendIMessage } from "./applescript";
import { postGatewayStatus } from "./callback";
import { getDb } from "./db";
import { messages } from "./schema";

type MessageRow = {
  id: string;
  toHandle: string;
  body: string;
  scheduledForUtc: Date;
  attemptCount: number;
  createdAt: Date;
};

function computeBackoffSeconds(
  attemptCount: number,
  baseSeconds: number,
  maxSeconds: number,
) {
  const backoff = baseSeconds * 2 ** Math.max(attemptCount - 1, 0);
  return Math.min(backoff, maxSeconds);
}

function isLockAcquired(affectedRows: number | undefined) {
  return affectedRows === 1;
}

function sortByFifo(rows: MessageRow[]) {
  return [...rows].sort((a, b) => {
    const scheduledDiff = a.scheduledForUtc.getTime() - b.scheduledForUtc.getTime();
    if (scheduledDiff !== 0) {
      return scheduledDiff;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

async function selectNextEligible(env: GatewayEnv) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const rows = await db
    .select({
      id: messages.id,
      toHandle: messages.toHandle,
      body: messages.body,
      scheduledForUtc: messages.scheduledForUtc,
      attemptCount: messages.attemptCount,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.status, "QUEUED"),
        lte(messages.scheduledForUtc, new Date()),
        isNull(messages.canceledAt),
      ),
    )
    .orderBy(asc(messages.scheduledForUtc), asc(messages.createdAt))
    .limit(5);

  const ordered = sortByFifo(rows);
  return ordered[0] ?? null;
}

async function lockMessage(env: GatewayEnv, messageId: string) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const [result] = await db
    .update(messages)
    .set({
      status: "SENDING",
      lockedAt: new Date(),
      lockedBy: "gateway-worker",
      updatedAt: new Date(),
    })
    .where(and(eq(messages.id, messageId), eq(messages.status, "QUEUED")));

  return isLockAcquired(result.affectedRows);
}

async function updateMessageSuccess(env: GatewayEnv, messageId: string) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  await db
    .update(messages)
    .set({
      status: "SENT",
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId));
}

async function updateMessageFailure(
  env: GatewayEnv,
  messageId: string,
  attemptCount: number,
  errorMessage: string,
  shouldRetry: boolean,
) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const nextScheduled = shouldRetry
    ? new Date(
        Date.now() +
          computeBackoffSeconds(
            attemptCount,
            env.baseBackoffSeconds,
            env.maxBackoffSeconds,
          ) *
            1000,
      )
    : null;

  await db
    .update(messages)
    .set({
      status: shouldRetry ? "QUEUED" : "FAILED",
      attemptCount,
      lastError: errorMessage,
      scheduledForUtc: nextScheduled ?? undefined,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId));
}

async function notifyStatus(
  env: GatewayEnv,
  payload: { messageId: string; status: "SENT" | "FAILED"; meta?: Record<string, unknown> },
) {
  const callbackPayload = GatewayStatusCallbackSchema.parse({
    messageId: payload.messageId,
    status: payload.status,
    payload: payload.meta,
  });
  return postGatewayStatus(callbackPayload, env);
}

async function runOnce(env: GatewayEnv) {
  const next = await selectNextEligible(env);
  if (!next) {
    return;
  }

  const locked = await lockMessage(env, next.id);
  if (!locked) {
    return;
  }

  console.log(`[gateway-worker] sending ${next.id} to ${next.toHandle}`);

  try {
    await sendIMessage(next.toHandle, next.body);
    await updateMessageSuccess(env, next.id);
    await notifyStatus(env, {
      messageId: next.id,
      status: "SENT",
      meta: { method: "applescript", sentAt: new Date().toISOString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const nextAttempt = next.attemptCount + 1;
    const shouldRetry = nextAttempt < env.maxAttempts;
    await updateMessageFailure(env, next.id, nextAttempt, message, shouldRetry);
    if (!shouldRetry) {
      await notifyStatus(env, {
        messageId: next.id,
        status: "FAILED",
        meta: { method: "applescript", error: message },
      });
    }
  }
}

function startWorker(env: GatewayEnv) {
  if (!env.workerEnabled) {
    console.log("[gateway-worker] disabled");
    return;
  }

  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required when worker is enabled.");
  }

  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runOnce(env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[gateway-worker] error: ${message}`);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, env.workerPollIntervalMs);
}

export {
  computeBackoffSeconds,
  isLockAcquired,
  runOnce,
  sortByFifo,
  startWorker,
};
