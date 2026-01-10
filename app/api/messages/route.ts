import { NextResponse } from "next/server";

import { CreateMessageInputSchema } from "@imessage-scheduler/shared";
import { getUserFromRequest } from "@/app/lib/auth/session";
import {
  createMessage,
  listMessagesForUser,
  type MessageStatus,
} from "@/app/lib/db/models/message.model";
import { MESSAGE_STATUSES } from "./status";

function parseDateParam(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  // New message schedule
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateMessageInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const scheduledForUtc = new Date(parsed.data.scheduled_for_local);
  if (Number.isNaN(scheduledForUtc.getTime())) {
    return NextResponse.json({ error: "invalid_datetime" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await createMessage({
    id,
    userId: user.id,
    toHandle: parsed.data.to_handle,
    body: parsed.data.body,
    scheduledForUtc,
    timezone: parsed.data.timezone,
  });

  return NextResponse.json({ id });
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));
  const status = searchParams.get("status");

  if (searchParams.get("from") && !from) {
    return NextResponse.json({ error: "invalid_from" }, { status: 400 });
  }

  if (searchParams.get("to") && !to) {
    return NextResponse.json({ error: "invalid_to" }, { status: 400 });
  }

  // get messages from known state statuses
  if (status && !MESSAGE_STATUSES.includes(status as MessageStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const filters = {
    from: from ?? undefined,
    to: to ?? undefined,
    status: (status ?? undefined) as MessageStatus | undefined,
  };

  const messages = await listMessagesForUser(user.id, filters);

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      scheduled_for_utc: message.scheduledForUtc.toISOString(),
      to_handle: message.toHandle,
      status: message.status,
      body_preview: message.body.slice(0, 120),
    })),
  });
}
