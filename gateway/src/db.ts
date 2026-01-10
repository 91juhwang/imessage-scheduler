import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

type DbClient = ReturnType<typeof drizzle<Record<string, never>, mysql.Pool>>;

let db: DbClient | null = null;

function getDb(databaseUrl: string) {
  if (db) {
    return db;
  }

  const pool = mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 4,
    waitForConnections: true,
  });

  db = drizzle(pool);
  return db;
}

export { getDb };
