import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { hashBody } from "@imessage-scheduler/shared";

type ReceiptCorrelation = {
  method: "chat.db";
  handle: string;
  bodyHash: string;
  sentAt: string;
  chatDbPath: string;
  messageRowId?: number;
  chatGuid?: string | null;
  confidence?: string;
  notes?: string;
};

type ChatDbClient = {
  prepare: (sql: string) => {
    get: (...args: Array<string | number>) => Record<string, unknown> | undefined;
    all: () => Array<Record<string, unknown>>;
  };
  close: () => void;
};

type ReceiptDeps = {
  openDb?: (dbPath: string) => ChatDbClient;
  fileExists?: (dbPath: string) => boolean;
};

type ReceiptRetryDeps = ReceiptDeps & {
  sleep?: (ms: number) => Promise<void>;
};

type ReceiptPollDeps = ReceiptDeps & {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

type ReceiptSnapshot = {
  delivered: boolean;
  received: boolean;
  deliveredAt?: string | null;
  receivedAt?: string | null;
  notes?: string;
};

const APPLE_EPOCH_SECONDS = 978307200;
const WINDOW_MS = 5 * 60 * 1000;
const CORRELATION_RETRY_ATTEMPTS = 8;
const CORRELATION_RETRY_DELAY_MS = 2000;
const RECEIPT_POLL_INTERVAL_MS = 10_000;
const RECEIPT_POLL_TIMEOUT_MS = 30 * 60 * 1000;

function getChatDbPath() {
  return path.join(os.homedir(), "Library", "Messages", "chat.db");
}

function toAppleEpochSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000) - APPLE_EPOCH_SECONDS;
}

function buildTimeWindow(sentAt: Date) {
  const centerSeconds = toAppleEpochSeconds(sentAt);
  const offsetSeconds = Math.floor(WINDOW_MS / 1000);
  const startSeconds = centerSeconds - offsetSeconds;
  const endSeconds = centerSeconds + offsetSeconds;
  const startNanos = startSeconds * 1_000_000_000;
  const endNanos = endSeconds * 1_000_000_000;
  return { startSeconds, endSeconds, startNanos, endNanos };
}

function appleEpochToDate(value: number | null | undefined) {
  if (!value || Number.isNaN(value) || value <= 0) {
    return null;
  }
  const seconds = value > 1_000_000_000_000 ? value / 1_000_000_000 : value;
  const unixSeconds = seconds + APPLE_EPOCH_SECONDS;
  return new Date(unixSeconds * 1000);
}

function getMessageColumns(db: ChatDbClient) {
  const rows = db.prepare("PRAGMA table_info(message)").all();
  const columns = new Set<string>();
  for (const row of rows) {
    if (typeof row.name === "string") {
      columns.add(row.name);
    }
  }
  return columns;
}

function buildReceiptQuery(columns: Set<string>) {
  const fields = ["ROWID as messageRowId", "guid as chatGuid"];
  if (columns.has("is_delivered")) {
    fields.push("is_delivered");
  }
  if (columns.has("is_read")) {
    fields.push("is_read");
  }
  if (columns.has("date_delivered")) {
    fields.push("date_delivered");
  }
  if (columns.has("date_read")) {
    fields.push("date_read");
  }

  return `SELECT ${fields.join(", ")} FROM message`;
}

function readReceiptSnapshot(
  correlation: ReceiptCorrelation,
  deps: ReceiptDeps = {},
): ReceiptSnapshot {
  const fileExists = deps.fileExists ?? fs.existsSync;
  if (!fileExists(correlation.chatDbPath)) {
    return { delivered: false, received: false, notes: "chat_db_not_found" };
  }

  const openDb =
    deps.openDb ??
    ((dbPath: string) =>
      new Database(dbPath, { readonly: true }) as unknown as ChatDbClient);

  let db: ChatDbClient | null = null;

  try {
    db = openDb(correlation.chatDbPath);
    const columns = getMessageColumns(db);
    const baseQuery = buildReceiptQuery(columns);
    const whereClause =
      typeof correlation.messageRowId === "number"
        ? " WHERE ROWID = ?"
        : correlation.chatGuid
          ? " WHERE guid = ?"
          : "";
    if (!whereClause) {
      return { delivered: false, received: false, notes: "missing_correlation" };
    }

    const row = db
      .prepare(`${baseQuery}${whereClause} LIMIT 1`)
      .get(
        typeof correlation.messageRowId === "number"
          ? correlation.messageRowId
          : correlation.chatGuid ?? "",
      ) as
      | {
          is_delivered?: number | null;
          is_read?: number | null;
          date_delivered?: number | null;
          date_read?: number | null;
        }
      | undefined;

    if (!row) {
      return { delivered: false, received: false, notes: "no_match" };
    }

    const deliveredAt = appleEpochToDate(row.date_delivered ?? null);
    const receivedAt = appleEpochToDate(row.date_read ?? null);
    const delivered =
      (typeof row.is_delivered === "number" && row.is_delivered === 1) ||
      Boolean(deliveredAt);
    const received =
      (typeof row.is_read === "number" && row.is_read === 1) || Boolean(receivedAt);

    return {
      delivered,
      received,
      deliveredAt: deliveredAt?.toISOString() ?? null,
      receivedAt: receivedAt?.toISOString() ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return { delivered: false, received: false, notes: `query_failed:${message}` };
  } finally {
    db?.close();
  }
}

async function attemptReceiptCorrelation(
  input: {
    handle: string;
    body: string;
    sentAt: Date;
    chatDbPath?: string;
  },
  deps: ReceiptDeps = {},
): Promise<ReceiptCorrelation> {
  const chatDbPath = input.chatDbPath ?? getChatDbPath();
  const base: ReceiptCorrelation = {
    method: "chat.db",
    handle: input.handle,
    bodyHash: hashBody(input.body),
    sentAt: input.sentAt.toISOString(),
    chatDbPath,
  };

  console.log("[gateway-receipt] starting correlation", {
    handle: base.handle,
    sentAt: base.sentAt,
    chatDbPath: base.chatDbPath,
  });

  const exists = deps.fileExists ?? fs.existsSync;
  if (!exists(chatDbPath)) {
    console.log("[gateway-receipt] chat.db not found", { chatDbPath });
    return { ...base, notes: "chat_db_not_found" };
  }

  const openDb =
    deps.openDb ??
    ((dbPath: string) =>
      new Database(dbPath, { readonly: true }) as unknown as ChatDbClient);

  const window = buildTimeWindow(input.sentAt);
  let db: ChatDbClient | null = null;

  try {
    db = openDb(chatDbPath);
    const row = db
      .prepare(
        `
          SELECT
            message.ROWID as messageRowId,
            message.guid as chatGuid
          FROM message
          JOIN handle ON handle.ROWID = message.handle_id
          WHERE handle.id = ?
            AND message.text = ?
            AND message.is_from_me = 1
            AND (
              message.date BETWEEN ? AND ?
              OR message.date BETWEEN ? AND ?
            )
          ORDER BY message.date DESC
          LIMIT 1
        `,
      )
      .get(
        input.handle,
        input.body,
        window.startSeconds,
        window.endSeconds,
        window.startNanos,
        window.endNanos,
      ) as { messageRowId?: number; chatGuid?: string | null } | undefined;

    if (!row) {
      console.log("[gateway-receipt] no match found", {
        handle: base.handle,
        sentAt: base.sentAt,
      });
      return { ...base, notes: "no_match" };
    }

    const result = {
      ...base,
      messageRowId: typeof row.messageRowId === "number" ? row.messageRowId : undefined,
      chatGuid: row.chatGuid ?? null,
      confidence: "exact_text_handle",
    };
    console.log("[gateway-receipt] match found", {
      handle: base.handle,
      messageRowId: result.messageRowId,
      chatGuid: result.chatGuid,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.log("[gateway-receipt] query failed", { error: message });
    return { ...base, notes: `query_failed:${message}` };
  } finally {
    db?.close();
  }
}

async function attemptReceiptCorrelationWithRetry(
  input: {
    handle: string;
    body: string;
    sentAt: Date;
    chatDbPath?: string;
  },
  deps: ReceiptRetryDeps = {},
  options: { attempts?: number; delayMs?: number } = {},
): Promise<ReceiptCorrelation> {
  const attempts = Math.max(options.attempts ?? CORRELATION_RETRY_ATTEMPTS, 1);
  const delayMs = Math.max(options.delayMs ?? CORRELATION_RETRY_DELAY_MS, 0);
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await attemptReceiptCorrelation(input, deps);
    if (result.messageRowId || result.chatGuid) {
      return result;
    }
    if (result.notes !== "no_match") {
      return result;
    }
    if (attempt < attempts && delayMs > 0) {
      console.log("[gateway-receipt] retrying correlation", {
        attempt,
        delayMs,
        handle: input.handle,
      });
      await sleep(delayMs);
    }
  }

  return attemptReceiptCorrelation(input, deps);
}

async function pollForReceiptUpdates(
  input: {
    messageId: string;
    correlation: ReceiptCorrelation;
    onStatus: (status: "DELIVERED" | "RECEIVED", payload: Record<string, unknown>) => Promise<void>;
    intervalMs?: number;
    timeoutMs?: number;
  },
  deps: ReceiptPollDeps = {},
) {
  const intervalMs = input.intervalMs ?? RECEIPT_POLL_INTERVAL_MS;
  const timeoutMs = input.timeoutMs ?? RECEIPT_POLL_TIMEOUT_MS;
  const now = deps.now ?? (() => Date.now());
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const correlation = input.correlation;
  if (!correlation.messageRowId && !correlation.chatGuid) {
    console.log("[gateway-receipt] skipping poll (no correlation row)", {
      messageId: input.messageId,
    });
    return;
  }

  const deadline = now() + timeoutMs;
  let deliveredNotified = false;

  while (now() < deadline) {
    const snapshot = readReceiptSnapshot(correlation, deps);
    if (snapshot.notes?.startsWith("query_failed")) {
      console.log("[gateway-receipt] polling stopped", {
        messageId: input.messageId,
        notes: snapshot.notes,
      });
      return;
    }

    if (snapshot.delivered && !deliveredNotified) {
      deliveredNotified = true;
      await input.onStatus("DELIVERED", {
        method: correlation.method,
        messageRowId: correlation.messageRowId,
        chatGuid: correlation.chatGuid,
        deliveredAt: snapshot.deliveredAt,
      });
    }

    if (snapshot.received) {
      if (!deliveredNotified) {
        await input.onStatus("DELIVERED", {
          method: correlation.method,
          messageRowId: correlation.messageRowId,
          chatGuid: correlation.chatGuid,
          deliveredAt: snapshot.deliveredAt,
        });
      }
      await input.onStatus("RECEIVED", {
        method: correlation.method,
        messageRowId: correlation.messageRowId,
        chatGuid: correlation.chatGuid,
        deliveredAt: snapshot.deliveredAt,
        receivedAt: snapshot.receivedAt,
      });
      return;
    }

    await sleep(intervalMs);
  }

  console.log("[gateway-receipt] polling timeout", {
    messageId: input.messageId,
    messageRowId: correlation.messageRowId,
    chatGuid: correlation.chatGuid,
  });
}

export {
  attemptReceiptCorrelation,
  attemptReceiptCorrelationWithRetry,
  getChatDbPath,
  pollForReceiptUpdates,
};
export type { ReceiptCorrelation };
