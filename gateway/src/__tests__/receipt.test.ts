import { describe, expect, it } from "vitest";

import {
  attemptReceiptCorrelation,
  attemptReceiptCorrelationWithRetry,
  pollForReceiptUpdates,
} from "../receipt";

describe("receipt correlation", () => {
  it("returns notes when chat.db is missing", async () => {
    const result = await attemptReceiptCorrelation(
      {
        handle: "+15551234567",
        body: "hello",
        sentAt: new Date("2025-01-01T00:00:00.000Z"),
        chatDbPath: "/missing/chat.db",
      },
      {
        fileExists: () => false,
      },
    );

    expect(result.notes).toBe("chat_db_not_found");
    expect(result.method).toBe("chat.db");
  });

  it("returns match data when a row is found", async () => {
    const result = await attemptReceiptCorrelation(
      {
        handle: "+15551234567",
        body: "hello",
        sentAt: new Date("2025-01-01T00:00:00.000Z"),
        chatDbPath: "/tmp/chat.db",
      },
      {
        fileExists: () => true,
        openDb: () => ({
          prepare: () => ({
            get: () => ({ messageRowId: 42, chatGuid: "guid-1" }),
            all: () => [{ name: "guid" }, { name: "date_delivered" }],
          }),
          close: () => undefined,
        }),
      },
    );

    expect(result.messageRowId).toBe(42);
    expect(result.chatGuid).toBe("guid-1");
    expect(result.confidence).toBe("exact_text_handle");
  });

  it("returns no_match when no row is found", async () => {
    const result = await attemptReceiptCorrelation(
      {
        handle: "+15551234567",
        body: "hello",
        sentAt: new Date("2025-01-01T00:00:00.000Z"),
        chatDbPath: "/tmp/chat.db",
      },
      {
        fileExists: () => true,
        openDb: () => ({
          prepare: () => ({
            get: () => undefined,
            all: () => [{ name: "guid" }],
          }),
          close: () => undefined,
        }),
      },
    );

    expect(result.notes).toBe("no_match");
  });

  it("polls and emits delivered then received", async () => {
    let pollCount = 0;
    const statuses: Array<{ status: string; payload: Record<string, unknown> }> = [];
    let now = 0;

    await pollForReceiptUpdates(
      {
        messageId: "msg-1",
        correlation: {
          method: "chat.db",
          handle: "+15551234567",
          bodyHash: "hash",
          sentAt: "2025-01-01T00:00:00.000Z",
          chatDbPath: "/tmp/chat.db",
          messageRowId: 1,
        },
        intervalMs: 10,
        timeoutMs: 50,
        onStatus: async (status, payload) => {
          statuses.push({ status, payload });
        },
      },
      {
        now: () => now,
        sleep: async (ms) => {
          now += ms;
        },
        fileExists: () => true,
        openDb: () => ({
          prepare: (sql: string) => {
            if (sql.includes("PRAGMA")) {
              return {
                all: () => [
                  { name: "guid" },
                  { name: "is_delivered" },
                  { name: "is_read" },
                  { name: "date_delivered" },
                  { name: "date_read" },
                ],
                get: () => undefined,
              };
            }

            return {
              all: () => [],
              get: () => {
                pollCount += 1;
                if (pollCount < 2) {
                  return { is_delivered: 0, is_read: 0 };
                }
                if (pollCount < 3) {
                  return { is_delivered: 1, is_read: 0 };
                }
                return { is_delivered: 1, is_read: 1 };
              },
            };
          },
          close: () => undefined,
        }),
      },
    );

    expect(statuses[0]?.status).toBe("DELIVERED");
    expect(statuses[1]?.status).toBe("RECEIVED");
  });

  it("retries correlation when the first attempt misses", async () => {
    let attempts = 0;
    const result = await attemptReceiptCorrelationWithRetry(
      {
        handle: "+15551234567",
        body: "hello",
        sentAt: new Date("2025-01-01T00:00:00.000Z"),
        chatDbPath: "/tmp/chat.db",
      },
      {
        fileExists: () => true,
        sleep: async () => undefined,
        openDb: () => {
          attempts += 1;
          return {
            prepare: () => ({
              get: () =>
                attempts < 2 ? undefined : { messageRowId: 7, chatGuid: "guid-7" },
              all: () => [{ name: "guid" }],
            }),
            close: () => undefined,
          };
        },
      },
      { attempts: 2, delayMs: 0 },
    );

    expect(result.messageRowId).toBe(7);
    expect(result.chatGuid).toBe("guid-7");
  });
});
