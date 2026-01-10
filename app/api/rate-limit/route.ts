import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/app/lib/auth/session";
import {
  getRateLimitByUserId,
  updateRateLimitByUserId,
} from "@/app/lib/db/models/rate_limit.model";
import { buildRateLimitSummary } from "@/app/lib/rate-limit";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const row = await getRateLimitByUserId(user.id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const summary = buildRateLimitSummary(new Date(), row, user.paidUser);

  return NextResponse.json({
    remaining_in_window: summary.remainingInWindow,
    max_per_hour: summary.maxPerHour,
    next_allowed_at: summary.nextAllowedAt?.toISOString() ?? null,
    paid_user: user.paidUser,
  });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  await updateRateLimitByUserId(user.id, {
    lastSentAt: null,
    windowStartedAt: now,
    sentInWindow: 0,
  });

  const row = await getRateLimitByUserId(user.id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const summary = buildRateLimitSummary(now, row, user.paidUser);

  return NextResponse.json({
    remaining_in_window: summary.remainingInWindow,
    max_per_hour: summary.maxPerHour,
    next_allowed_at: summary.nextAllowedAt?.toISOString() ?? null,
    paid_user: user.paidUser,
  });
}
