import { describe, expect, it } from "vitest";

import { getSessionIdFromRequest, SESSION_COOKIE_NAME } from "../cookies";

describe("session cookies", () => {
  it("reads session id from request cookie header", async () => {
    const request = new Request("http://localhost", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=session-123; other=value`,
      },
    });

    await expect(getSessionIdFromRequest(request)).resolves.toBe("session-123");
  });

  it("returns null when cookie header missing", async () => {
    const request = new Request("http://localhost");

    await expect(getSessionIdFromRequest(request)).resolves.toBeNull();
  });
});
