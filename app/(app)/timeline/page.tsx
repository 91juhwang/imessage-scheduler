import { redirect } from "next/navigation";

import { getUserFromRequest } from "@/app/lib/auth/session";
import { listMessagesForUser } from "@/app/lib/db/models/message.model";
import { addDays, parseDateKey, startOfDay } from "@/app/lib/date-utils";
import { TimelineView } from "./TimelineView";

type TimelinePageProps = {
  searchParams?: Promise<{ date?: string }>;
};

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const user = await getUserFromRequest();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const parsedDate = parseDateKey(params?.date ?? null);
  const start = startOfDay(parsedDate ?? new Date());
  const end = addDays(start, 1);
  const messages = await listMessagesForUser(user.id, { from: start, to: end });

  return (
    <TimelineView
      initialDateIso={start.toISOString()}
      initialMessages={messages.map((message) => ({
        id: message.id,
        scheduled_for_utc: message.scheduledForUtc.toISOString(),
        to_handle: message.toHandle,
        status: message.status,
        body: message.body,
        body_preview: message.body.slice(0, 120),
      }))}
    />
  );
}
