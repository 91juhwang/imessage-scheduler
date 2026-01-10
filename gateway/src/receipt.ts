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
  };
  close: () => void;
};

type ReceiptDeps = {
  openDb?: (dbPath: string) => ChatDbClient;
  fileExists?: (dbPath: string) => boolean;
};

const APPLE_EPOCH_SECONDS = 978307200;
const WINDOW_MS = 5 * 60 * 1000;

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

    console.log('james: ', base)
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

export { attemptReceiptCorrelation, getChatDbPath };
export type { ReceiptCorrelation };
