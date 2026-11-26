import { type QueryHandlerContext, queryHandler } from "@kronos-ts/core"
import type { PostgresCapability } from "@kronos-ts/postgres"
import { GetInventory } from "./query"

export const handle = queryHandler(GetInventory, async (_query, ctx: QueryHandlerContext & PostgresCapability) => {
  const rows = await ctx.sql().query<{ tool_id: string; name: string; available: boolean }>(
    `SELECT tool_id, name, available FROM inventory ORDER BY tool_id`,
  )
  return rows.map((row) => ({ toolId: row.tool_id, name: row.name, available: row.available }))
})
