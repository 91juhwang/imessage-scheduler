import { eq } from "drizzle-orm";

import { db } from "../index";
import { messages } from "../schema";

export type MessageStatus =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "RECEIVED"
  | "FAILED"
  | "CANCELED";

export type MessageRow = {
  id: string;
  userId: string;
  toHandle: string;
  body: string;
  scheduledForUtc: Date;
  timezone: string;
  status: MessageStatus;
  attemptCount: number;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  gatewayMessageId: string | null;
  deliveredAt: Date | null;
  receivedAt: Date | null;
  receiptCorrelation: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: Date | null;
};

export type CreateMessageInput = Pick<
  MessageRow,
  "id" | "userId" | "toHandle" | "body" | "scheduledForUtc" | "timezone"
>;

export type UpdateMessagePatch = Partial<
  Pick<
    MessageRow,
    | "toHandle"
    | "body"
    | "scheduledForUtc"
    | "timezone"
    | "status"
    | "attemptCount"
    | "lastError"
    | "lockedAt"
    | "lockedBy"
    | "gatewayMessageId"
    | "deliveredAt"
    | "receivedAt"
    | "receiptCorrelation"
    | "updatedAt"
    | "canceledAt"
  >
>;

export async function createMessage(input: CreateMessageInput) {
  await db.insert(messages).values(input);
  return input;
}

export async function getMessageById(id: string): Promise<MessageRow | null> {
  const rows = await db
    .select({
      id: messages.id,
      userId: messages.userId,
      toHandle: messages.toHandle,
      body: messages.body,
      scheduledForUtc: messages.scheduledForUtc,
      timezone: messages.timezone,
      status: messages.status,
      attemptCount: messages.attemptCount,
      lastError: messages.lastError,
      lockedAt: messages.lockedAt,
      lockedBy: messages.lockedBy,
      gatewayMessageId: messages.gatewayMessageId,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      canceledAt: messages.canceledAt,
      deliveredAt: messages.deliveredAt,
      receivedAt: messages.receivedAt,
      receiptCorrelation: messages.receiptCorrelation,
    })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row,
    receiptCorrelation: row.receiptCorrelation as Record<string, unknown> | null,
  };
}

export async function updateMessageById(
  id: string,
  patch: UpdateMessagePatch,
) {
  if (Object.keys(patch).length === 0) {
    return 0;
  }
  const [result] = await db.update(messages).set(patch).where(eq(messages.id, id));
  return result.affectedRows ?? 0;
}
