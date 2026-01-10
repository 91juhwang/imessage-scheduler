import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.GATEWAY_SECRET ||= "test-secret";

function extractSessionCookie(setCookie: string | null) {
  if (!setCookie) {
    return null;
  }
  const parts = setCookie.split(";");
  return parts[0] ?? null;
}

describe.skipIf(!hasDatabase)("auth api", () => {
  it("logs in and returns session", async () => {
    const { hashPassword } = await import("@/app/lib/auth/password");
    const { createUser } = await import("@/app/lib/db/models/user.model");
    const { POST } = await import("@/app/api/auth/login/route");

    const email = `test-${crypto.randomUUID()}@example.com`;
    const password = "password123";
    const passwordHash = await hashPassword(password);

    await createUser({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      paidUser: false,
      createdAt: new Date(),
    });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.email).toBe(email);
    expect(payload.paid_user).toBe(false);

    const cookie = extractSessionCookie(response.headers.get("set-cookie"));
    expect(cookie).toContain("sid=");
  });

  it("supports me and logout", async () => {
    const { hashPassword } = await import("@/app/lib/auth/password");
    const { createUser } = await import("@/app/lib/db/models/user.model");
    const { POST: login } = await import("@/app/api/auth/login/route");
    const { GET: me } = await import("@/app/api/auth/me/route");
    const { POST: logout } = await import("@/app/api/auth/logout/route");

    const email = `test-${crypto.randomUUID()}@example.com`;
    const password = "password123";
    const passwordHash = await hashPassword(password);

    await createUser({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      paidUser: true,
      createdAt: new Date(),
    });

    const loginRequest = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const loginResponse = await login(loginRequest);
    const sessionCookie = extractSessionCookie(
      loginResponse.headers.get("set-cookie"),
    );

    expect(sessionCookie).toBeTruthy();

    const meRequest = new Request("http://localhost/api/auth/me", {
      headers: { cookie: sessionCookie ?? "" },
    });

    const meResponse = await me(meRequest);
    expect(meResponse.status).toBe(200);

    const mePayload = await meResponse.json();
    expect(mePayload.email).toBe(email);
    expect(mePayload.paid_user).toBe(true);

    const logoutRequest = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: sessionCookie ?? "" },
    });

    const logoutResponse = await logout(logoutRequest);
    expect(logoutResponse.status).toBe(200);

    const meAfterLogout = await me(meRequest);
    expect(meAfterLogout.status).toBe(401);
  });
});
