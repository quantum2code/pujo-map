import { geometry, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

export type OpeningHours =
  | { type: "24_7" }
  | { type: "none" }
  | {
      type: "weekly";
      days: Record<number, [string, string][]>;
    };

export const place = pgTable("place", {
  id: varchar("id", { length: 255 }).unique().notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  amenity: varchar("amenity", { length: 255 }),
  cuisine: varchar("cuisine", { length: 255 }).array(),
  openingHours: jsonb("opening_hours").$type<OpeningHours>(),
  properties: jsonb("properties"),
  location: geometry("location", { type: "point", srid: 4326 }),
});
