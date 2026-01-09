export const MessageStatus = {
  QUEUED: "QUEUED",
  SENDING: "SENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  RECEIVED: "RECEIVED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];
