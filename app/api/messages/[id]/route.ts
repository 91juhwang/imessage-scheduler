import { NextResponse } from "next/server";

import { UpdateMessageInputSchema } from "@imessage-scheduler/shared";
import { getUserFromRequest } from "@/app/lib/auth/session";
import {
  getMessageById,
  updateMessageById,
} from "@/app/lib/db/models/message.model";
import { isImmutableStatus } from "./status";

function parseScheduledDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateMessageInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const message = await getMessageById(context.params.id);
  if (!message || message.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isImmutableStatus(message.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 409 });
  }

  const scheduledForUtc = parseScheduledDate(parsed.data.scheduled_for_local);
  if (parsed.data.scheduled_for_local && !scheduledForUtc) {
    return NextResponse.json({ error: "invalid_datetime" }, { status: 400 });
  }

  await updateMessageById(message.id, {
    toHandle: parsed.data.to_handle,
    body: parsed.data.body,
    scheduledForUtc: scheduledForUtc ?? undefined,
    timezone: parsed.data.timezone,
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
