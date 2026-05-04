import { geometry, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

export const place = pgTable("place", {
  id: varchar({ length: 255 }).unique().notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  cuisine: varchar("cuisine", { length: 255 }).array(),
  opening_hrs: varchar("opening_hrs", { length: 255 }),
  properties: jsonb("properties"),
  location: geometry("location", { type: "point", srid: 4326 }),
});
