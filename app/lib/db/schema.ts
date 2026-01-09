import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    paidUser: boolean("paid_user").notNull().default(false),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const userRateLimit = mysqlTable(
  "user_rate_limit",
  {
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id)
      .primaryKey(),
    lastSentAt: datetime("last_sent_at"),
    windowStartedAt: datetime("window_started_at"),
    sentInWindow: int("sent_in_window").notNull().default(0),
  },
  (table) => [index("user_rate_limit_user_id_idx").on(table.userId)],
);

export const messageStatusEnum = mysqlEnum("message_status", [
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "RECEIVED",
  "FAILED",
  "CANCELED",
]);

export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    toHandle: varchar("to_handle", { length: 255 }).notNull(),
    body: text("body").notNull(),
    scheduledForUtc: datetime("scheduled_for_utc").notNull(),
    timezone: varchar("timezone", { length: 255 }).notNull(),
    status: messageStatusEnum.notNull().default("QUEUED"),
    attemptCount: int("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: datetime("locked_at"),
    lockedBy: varchar("locked_by", { length: 255 }),
    gatewayMessageId: varchar("gateway_message_id", { length: 255 }),
    deliveredAt: datetime("delivered_at"),
    receivedAt: datetime("received_at"),
    receiptCorrelation: json("receipt_correlation"),
    createdAt: datetime("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    canceledAt: datetime("canceled_at"),
  },
  (table) => [
    index("messages_user_id_scheduled_for_utc_idx").on(
      table.userId,
      table.scheduledForUtc,
    ),
    index("messages_status_idx").on(table.status),
    index("messages_scheduled_for_utc_idx").on(table.scheduledForUtc),
  ],
);
