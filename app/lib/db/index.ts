import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "../env";

export const pool = mysql.createPool({ uri: env.DATABASE_URL });

export const db = drizzle(pool);
