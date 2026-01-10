import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function initDb() {
  if (db) {
    return db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  pool = mysql.createPool({ uri: databaseUrl });
  db = drizzle(pool);
  return db;
}

export function getDb() {
  return initDb();
}

export function getPool() {
  initDb();
  return pool!;
}
