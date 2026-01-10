import "dotenv/config";
import { hashPassword } from "../auth/password";
import { getPool } from "./index";
import { createRateLimitRow, getRateLimitByUserId } from "./models/rate_limit.model";
import { createUser, getUserByEmail } from "./models/user.model";

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
  const existing = await getUserByEmail(email);
  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await createUser({
    id,
    email,
    passwordHash,
    paidUser,
    createdAt: new Date(),
  });

  return id;
}

async function ensureRateLimitRow(userId: string) {
  const existing = await getRateLimitByUserId(userId);
  if (existing) {
    return;
  }

  await createRateLimitRow({
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
    await getPool().end();
  }
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
