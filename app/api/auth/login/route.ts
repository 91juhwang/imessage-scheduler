import { NextResponse } from "next/server";

import { LoginInputSchema } from "@imessage-scheduler/shared";
import { verifyPassword } from "@/app/lib/auth/password";
import {
  createSession,
  setSessionCookie,
} from "@/app/lib/auth/session";
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LoginInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      paidUser: users.paidUser,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { sessionId, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({
    id: user.id,
    email: user.email,
    paid_user: user.paidUser,
  });

  setSessionCookie(response, sessionId, expiresAt);

  return response;
}
