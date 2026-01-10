import { NextResponse } from "next/server";

import { getSessionIdFromRequest, SESSION_COOKIE_NAME } from "./cookies";
import {
  createSessionRow,
  deleteSessionById,
  getSessionById,
} from "../db/models/session.model";
import { getUserById } from "../db/models/user.model";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function createSession(userId: string) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await createSessionRow({
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

  const session = await getSessionById(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await deleteSessionById(session.id);
    return null;
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    paidUser: user.paidUser,
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
  await deleteSessionById(sessionId);
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
