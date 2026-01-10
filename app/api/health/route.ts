import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { getDb } from "@/app/lib/db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "db_unavailable" },
      { status: 500 },
    );
  }
}
