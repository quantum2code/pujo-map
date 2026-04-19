import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },

  (table) => ({
    userIdIdx: index("message_user_id_idx").on(table.userId),
  }),
);
