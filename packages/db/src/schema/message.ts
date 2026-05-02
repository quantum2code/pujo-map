import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "processing",
  "processed",
  "failed",
]);

export const message = pgTable(
  "message",
  {
    id: text()
      .primaryKey()
      .default(sql`gen_random_uuid()`)
      .notNull(),
    text: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id),
    status: messageStatusEnum().default("queued").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },

  (table) => ({
    userIdIdx: index("message_user_id_idx").on(table.userId),
  }),
);
