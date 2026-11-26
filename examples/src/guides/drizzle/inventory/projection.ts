import { type EventHandlerContext, eventHandler } from "@kronos-ts/core"
import { eq } from "drizzle-orm"
import { ToolAdded, ToolRented } from "../../../toolstore/slices/toolstore/events"
import type { DrizzleCapability } from "../drizzle"
import { inventory } from "./schema"

export const projection = [
  eventHandler(ToolAdded, async ({ payload }, ctx: EventHandlerContext & DrizzleCapability) => {
    await ctx.db
      .insert(inventory)
      .values({ toolId: payload.toolId, name: payload.name, available: true })
      .onConflictDoUpdate({ target: inventory.toolId, set: { name: payload.name } })
  }),
  eventHandler(ToolRented, async ({ payload }, ctx: EventHandlerContext & DrizzleCapability) => {
    await ctx.db.update(inventory).set({ available: false }).where(eq(inventory.toolId, payload.toolId))
  }),
]
