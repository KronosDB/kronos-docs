import { eventHandler, queryHandler, type EventHandlerContext, type QueryHandlerContext } from "@kronos-ts/core"
import type { PostgresCapability } from "@kronos-ts/postgres"
import { GetInventory, ToolAdded, ToolRented, ToolReturned } from "./toolstore.js"

export const createInventoryTable = `
  CREATE TABLE IF NOT EXISTS inventory (
    tool_id   text PRIMARY KEY,
    name      text NOT NULL,
    available boolean NOT NULL
  )`

export const recordAddedTool = eventHandler(
  ToolAdded,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(
      `INSERT INTO inventory (tool_id, name, available) VALUES ($1, $2, true)
       ON CONFLICT (tool_id) DO UPDATE SET name = EXCLUDED.name`,
      [payload.toolId, payload.name],
    )
  },
)

export const recordRentedTool = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(`UPDATE inventory SET available = false WHERE tool_id = $1`, [payload.toolId])
  },
)

export const recordReturnedTool = eventHandler(
  ToolReturned,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(`UPDATE inventory SET available = true WHERE tool_id = $1`, [payload.toolId])
  },
)

export const getInventory = queryHandler(
  GetInventory,
  async (_query, ctx: QueryHandlerContext & PostgresCapability) => {
    const rows = await ctx.sql().query<{ tool_id: string; name: string; available: boolean }>(
      `SELECT tool_id, name, available FROM inventory ORDER BY tool_id`,
    )
    return rows.map((row) => ({ toolId: row.tool_id, name: row.name, available: row.available }))
  },
)
