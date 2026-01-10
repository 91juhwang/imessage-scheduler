import { NextResponse } from "next/server";
import { getSessionIdFromRequest } from "@/app/lib/auth/cookies";
import { clearSessionCookie, deleteSession } from "@/app/lib/auth/session";

export async function POST(request: Request) {
  const sessionId = await getSessionIdFromRequest(request);

  if (sessionId) {
    await deleteSession(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}
