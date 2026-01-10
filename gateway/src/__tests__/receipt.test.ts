import { describe, expect, it } from "vitest";

import { attemptReceiptCorrelation } from "../receipt";

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
          }),
          close: () => undefined,
        }),
      },
    );

    expect(result.notes).toBe("no_match");
  });
});
