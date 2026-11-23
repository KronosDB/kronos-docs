import { type EventHandlerContext, eventHandler } from "@kronos-ts/core"
import type { PostgresCapability } from "@kronos-ts/postgres"
import { ToolAdded, ToolRented } from "../events"

export const projection = [
  eventHandler(ToolAdded, async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(
      `INSERT INTO inventory (tool_id, name, available) VALUES ($1, $2, true)
       ON CONFLICT (tool_id) DO UPDATE SET name = EXCLUDED.name`,
      [payload.toolId, payload.name],
    )
  }),
  eventHandler(ToolRented, async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(`UPDATE inventory SET available = false WHERE tool_id = $1`, [payload.toolId])
  }),
]
