import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/app/lib/auth/session";
import {
  getMessageById,
  updateMessageById,
} from "@/app/lib/db/models/message.model";
import { isImmutableStatus } from "../status";

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const message = await getMessageById(context.params.id);
  if (!message || message.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isImmutableStatus(message.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 409 });
  }

  if (message.status !== "QUEUED") {
    return NextResponse.json({ error: "not_queued" }, { status: 409 });
  }

  await updateMessageById(message.id, {
    status: "CANCELED",
    canceledAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
