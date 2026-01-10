import { redirect } from "next/navigation";

import { getUserFromRequest } from "@/app/lib/auth/session";
import { listMessagesForUser } from "@/app/lib/db/models/message.model";
import { getOrCreateRateLimitRow } from "@/app/lib/db/models/rate_limit.model";
import { buildRateLimitSummary } from "@/app/lib/rate-limit";
import { addDays, endOfDay, startOfWeek } from "@/app/lib/date-utils";
import type { DashboardMessage, RateLimitResponse } from "./dashboard-types";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const user = await getUserFromRequest();
  if (!user) {
    redirect("/login");
  }

  const start = startOfWeek(new Date());
  const end = endOfDay(addDays(start, 6));
  const messages = await listMessagesForUser(user.id, { from: start, to: end });
  const initialMessages: DashboardMessage[] = messages.map((message) => ({
    id: message.id,
    scheduled_for_utc: message.scheduledForUtc.toISOString(),
    to_handle: message.toHandle,
    status: message.status,
    attempt_count: message.attemptCount,
    last_error: message.lastError,
    delivered_at: message.deliveredAt?.toISOString() ?? null,
    received_at: message.receivedAt?.toISOString() ?? null,
    body: message.body,
    receipt_correlation:
      (message.receiptCorrelation as Record<string, unknown> | null) ?? null,
  }));

  const rateLimitRow = await getOrCreateRateLimitRow(user.id);
  const summary = buildRateLimitSummary(new Date(), rateLimitRow, user.paidUser);
  const initialRateLimit: RateLimitResponse = {
    remaining_in_window: summary.remainingInWindow,
    max_per_hour: summary.maxPerHour,
    next_allowed_at: summary.nextAllowedAt?.toISOString() ?? null,
    paid_user: user.paidUser,
  };

  return (
    <DashboardView
      initialMessages={initialMessages}
      initialRateLimit={initialRateLimit}
    />
  );
}
