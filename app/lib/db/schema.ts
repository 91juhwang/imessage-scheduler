import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const scheduledMessages = sqliteTable("scheduled_messages", {
  id: text("id").primaryKey(),
  to: text("to").notNull(),
  text: text("text").notNull(),

  runAt: integer("run_at").notNull(), // epoch ms
  position: integer("position").notNull(),

  status: text("status").notNull(), // QUEUED | ACCEPTED | SENT | FAILED ...
  lockedAt: integer("locked_at"),
  lockOwner: text("lock_owner"),

  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),

  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(), // always "global"
  lastSentAt: integer("last_sent_at"),
});