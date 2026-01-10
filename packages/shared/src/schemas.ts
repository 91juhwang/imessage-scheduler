import { z } from "zod";

import { isValidUsPhone } from "./phone";
import { MessageStatus } from "./status";

const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const TimeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: "Invalid time zone" });

const IsoDateTimeWithOffsetSchema = z.iso.datetime({ offset: true });

export const LoginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const CreateMessageInputSchema = z.object({
  to_handle: z.string().min(1).refine(isValidUsPhone, {
    message: "Invalid phone number",
  }),
  body: z.string().min(1).max(2000),
  scheduled_for_local: IsoDateTimeWithOffsetSchema,
  timezone: TimeZoneSchema,
});

export const UpdateMessageInputSchema = z.object({
  to_handle: z
    .string()
    .min(1)
    .refine(isValidUsPhone, { message: "Invalid phone number" })
    .optional(),
  body: z.string().min(1).max(2000).optional(),
  scheduled_for_local: IsoDateTimeWithOffsetSchema.optional(),
  timezone: TimeZoneSchema.optional(),
});

export const GatewaySendRequestSchema = z.object({
  messageId: z.uuid(),
  to: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export const GatewaySendResponseSchema = z.object({
  status: z.enum(["SENT", "FAILED"]),
  gatewayMessageId: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export const GatewayStatusCallbackSchema = z.object({
  messageId: z.uuid(),
  status: z.enum([
    MessageStatus.SENT,
    MessageStatus.DELIVERED,
    MessageStatus.RECEIVED,
    MessageStatus.FAILED,
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageInputSchema>;
export type GatewaySendRequest = z.infer<typeof GatewaySendRequestSchema>;
export type GatewaySendResponse = z.infer<typeof GatewaySendResponseSchema>;
export type GatewayStatusCallback = z.infer<typeof GatewayStatusCallbackSchema>;
