import type { EventHandlerContext, EventMessage } from "@kronos-ts/core"
import { eventHandler } from "@kronos-ts/core"
import { inventory } from "../drizzle/inventory/schema"
import { ToolAdded, ToolRented } from "../../toolstore/slices/toolstore/events"
import { type Repositories, repositoryHandler } from "./repository"

type Context = EventHandlerContext & Repositories<{ inventory: typeof inventory }>

/** The events of one tool stay in order; different tools run side by side. */
export const byTool = (event: EventMessage) => (event.payload as { toolId?: string }).toolId ?? event.identifier

export const projection = [
  eventHandler(
    ToolAdded,
    repositoryHandler(({ payload }, ctx: Context) => {
      ctx.inventory.save({ toolId: payload.toolId, name: payload.name, available: true })
    }, { inventory }),
  ),
  eventHandler(
    ToolRented,
    repositoryHandler(async ({ payload }, ctx: Context) => {
      const tool = await ctx.inventory.get(payload.toolId)
      if (tool) ctx.inventory.save({ ...tool, available: false })
    }, { inventory }),
  ),
]

