// Just for typescript definition - not transpiled
import {
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const messageStatusEnum = mysqlEnum("message_status", [
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "RECEIVED",
  "FAILED",
  "CANCELED",
]);

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  toHandle: varchar("to_handle", { length: 255 }).notNull(),
  body: text("body").notNull(),
  scheduledForUtc: datetime("scheduled_for_utc").notNull(),
  timezone: varchar("timezone", { length: 255 }).notNull(),
  status: messageStatusEnum.notNull(),
  attemptCount: int("attempt_count").notNull(),
  lastError: text("last_error"),
  lockedAt: datetime("locked_at"),
  lockedBy: varchar("locked_by", { length: 255 }),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
  canceledAt: datetime("canceled_at"),
});
