import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE_NAME = "sid";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getSessionIdFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return part.slice(`${SESSION_COOKIE_NAME}=`.length);
    }
  }

  return null;
}

export async function getSessionIdFromRequest(request?: Request) {
  if (request) {
    return getSessionIdFromCookieHeader(request.headers.get("cookie"));
  }

  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function createSession(userId: string) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  return { sessionId, expiresAt };
}

export async function getUserFromRequest(request?: Request) {
  const sessionId = await getSessionIdFromRequest(request);

  if (!sessionId) {
    return null;
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      paidUser: users.paidUser,
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  if (row.expiresAt <= new Date()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    paidUser: row.paidUser,
  };
}

export async function requireUser(request?: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  expiresAt: Date,
) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
}
