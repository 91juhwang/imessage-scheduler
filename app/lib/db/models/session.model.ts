import { and, eq, gt } from "drizzle-orm";

import { getDb } from "../index";
import { sessions } from "../schema";

export type SessionRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type CreateSessionInput = SessionRow;

export async function createSessionRow(input: CreateSessionInput) {
  await getDb().insert(sessions).values(input);
  return input;
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionRow | null> {
  const rows = await getDb()
    .select({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function deleteSessionById(sessionId: string): Promise<number> {
  const [result] = await getDb()
    .delete(sessions)
    .where(eq(sessions.id, sessionId));
  return result.affectedRows ?? 0;
}

export async function isSessionActive(sessionId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows.length > 0;
}
