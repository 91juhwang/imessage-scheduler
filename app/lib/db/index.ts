import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";

type DbClient = ReturnType<typeof drizzle<Record<string, never>, Pool>>;

type DbStore = {
  pool: Pool | null;
  db: DbClient | null;
};

const globalStore = globalThis as typeof globalThis & {
  __imessageDbStore?: DbStore;
};

const store = globalStore.__imessageDbStore ?? { pool: null, db: null };
if (!globalStore.__imessageDbStore) {
  globalStore.__imessageDbStore = store;
}

function initDb(): DbClient {
  if (store.db) {
    return store.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  store.pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    waitForConnections: true,
  });
  store.db = drizzle(store.pool);
  return store.db;
}

export function getDb(): DbClient {
  return initDb();
}

export function getPool(): Pool {
  initDb();
  return store.pool!;
}
