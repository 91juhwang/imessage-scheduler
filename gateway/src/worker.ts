import { and, asc, eq, isNull, lte } from "drizzle-orm";

import { GatewayStatusCallbackSchema, applySend, evaluateRateLimit } from "@imessage-scheduler/shared";

import type { GatewayEnv } from "./env";
import { sendIMessage } from "./applescript";
import { postGatewayStatus } from "./callback";
import { getDb } from "./db";
import { messages, userRateLimit, users } from "./schema";

type MessageRow = {
  id: string;
  userId: string;
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

async function selectEligibleBatch(env: GatewayEnv) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const rows = await db
    .select({
      id: messages.id,
      userId: messages.userId,
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
    .limit(10);

  return sortByFifo(rows);
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

async function getRateLimitState(env: GatewayEnv, userId: string) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const [userRow] = await db
    .select({ paidUser: users.paidUser })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [limitRow] = await db
    .select({
      lastSentAt: userRateLimit.lastSentAt,
      windowStartedAt: userRateLimit.windowStartedAt,
      sentInWindow: userRateLimit.sentInWindow,
    })
    .from(userRateLimit)
    .where(eq(userRateLimit.userId, userId))
    .limit(1);

  return {
    paidUser: userRow?.paidUser ?? false,
    rateLimit: limitRow ?? {
      lastSentAt: null,
      windowStartedAt: null,
      sentInWindow: 0,
    },
  };
}

async function updateRateLimitAfterSend(
  env: GatewayEnv,
  userId: string,
  paidUser: boolean,
  now: Date,
  current: { lastSentAt: Date | null; windowStartedAt: Date | null; sentInWindow: number },
) {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required for worker.");
  }

  const db = getDb(env.databaseUrl);
  const config = {
    free: {
      minIntervalSeconds: env.freeMinIntervalSeconds,
      maxPerHour: env.freeMaxPerHour,
    },
    paid: {
      minIntervalSeconds: env.paidMinIntervalSeconds,
      maxPerHour: env.paidMaxPerHour,
    },
  };
  const nextState = applySend(now, current, paidUser, config);

  const [result] = await db
    .update(userRateLimit)
    .set({
      lastSentAt: nextState.lastSentAt,
      windowStartedAt: nextState.windowStartedAt,
      sentInWindow: nextState.sentInWindow,
    })
    .where(eq(userRateLimit.userId, userId));

  if ((result.affectedRows ?? 0) === 0) {
    await db.insert(userRateLimit).values({
      userId,
      lastSentAt: nextState.lastSentAt,
      windowStartedAt: nextState.windowStartedAt,
      sentInWindow: nextState.sentInWindow,
    });
  }
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
  const batch = await selectEligibleBatch(env);
  if (batch.length === 0) {
    return;
  }

  const now = new Date();
  const config = {
    free: {
      minIntervalSeconds: env.freeMinIntervalSeconds,
      maxPerHour: env.freeMaxPerHour,
    },
    paid: {
      minIntervalSeconds: env.paidMinIntervalSeconds,
      maxPerHour: env.paidMaxPerHour,
    },
  };

  for (const candidate of batch) {
    const { paidUser, rateLimit } = await getRateLimitState(env, candidate.userId);
    const decision = evaluateRateLimit(now, rateLimit, paidUser, config);
    if (!decision.allowed) {
      continue;
    }

    const locked = await lockMessage(env, candidate.id);
    if (!locked) {
      continue;
    }

    console.log(`[gateway-worker] sending ${candidate.id} to ${candidate.toHandle}`);

    try {
      await sendIMessage(candidate.toHandle, candidate.body);
      await updateMessageSuccess(env, candidate.id);
      await updateRateLimitAfterSend(env, candidate.userId, paidUser, now, decision.normalized);
      await notifyStatus(env, {
        messageId: candidate.id,
        status: "SENT",
        meta: { method: "applescript", sentAt: new Date().toISOString() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const nextAttempt = candidate.attemptCount + 1;
      const shouldRetry = nextAttempt < env.maxAttempts;
      await updateMessageFailure(env, candidate.id, nextAttempt, message, shouldRetry);
      if (!shouldRetry) {
        await notifyStatus(env, {
          messageId: candidate.id,
          status: "FAILED",
          meta: { method: "applescript", error: message },
        });
      }
    }
    return;
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
