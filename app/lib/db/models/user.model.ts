import { eq } from "drizzle-orm";

import { db } from "../index";
import { users } from "../schema";

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  paidUser: boolean;
  createdAt: Date;
};

export type CreateUserInput = UserRow;
export type UpdateUserPatch = Partial<Pick<UserRow, "email" | "passwordHash" | "paidUser">>;

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      paidUser: users.paidUser,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      paidUser: users.paidUser,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createUser(input: CreateUserInput) {
  await db.insert(users).values(input);
  return input;
}

export async function updateUserById(id: string, patch: UpdateUserPatch) {
  if (Object.keys(patch).length === 0) {
    return 0;
  }
  const [result] = await db.update(users).set(patch).where(eq(users.id, id));
  return result.affectedRows ?? 0;
}
