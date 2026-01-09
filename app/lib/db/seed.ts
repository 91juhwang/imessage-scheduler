import "dotenv/config";
import { eq } from "drizzle-orm";

import { hashPassword } from "../auth/password";
import { db, pool } from "./index";
import { userRateLimit, users } from "./schema";

const seedUsers = [
  {
    email: "user1@example.com",
    password: "password123",
    paidUser: false,
  },
  {
    email: "user2@example.com",
    password: "password123",
    paidUser: true,
  },
];

async function ensureUser({
  email,
  password,
  paidUser,
}: {
  email: string;
  password: string;
  paidUser: boolean;
}) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    paidUser,
    createdAt: new Date(),
  });

  return id;
}

async function ensureRateLimitRow(userId: string) {
  const existing = await db
    .select({ userId: userRateLimit.userId })
    .from(userRateLimit)
    .where(eq(userRateLimit.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(userRateLimit).values({
    userId,
    lastSentAt: null,
    windowStartedAt: null,
    sentInWindow: 0,
  });
}

async function seed() {
  try {
    for (const entry of seedUsers) {
      const userId = await ensureUser(entry);
      await ensureRateLimitRow(userId);
    }

    console.log("Seeded users and rate limit rows.");
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
