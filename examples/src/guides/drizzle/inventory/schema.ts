import { boolean, pgTable, text } from "drizzle-orm/pg-core"

/** One row per tool. Every write sets a value, so handling an event twice leaves the same row. */
export const inventory = pgTable("inventory", {
  toolId: text("tool_id").primaryKey(),
  name: text("name").notNull(),
  available: boolean("available").notNull(),
})
