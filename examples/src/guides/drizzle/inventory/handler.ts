import { type QueryHandlerContext, queryHandler } from "@kronos-ts/core"
import { asc } from "drizzle-orm"
import { GetInventory, type InventoryRow } from "../../../toolstore/slices/toolstore/inventory/query"
import type { DrizzleCapability } from "../drizzle"
import { inventory } from "./schema"

export const handle = queryHandler(GetInventory, async (_query, ctx: QueryHandlerContext & DrizzleCapability): Promise<InventoryRow[]> => {
  return ctx.db
    .select({ toolId: inventory.toolId, name: inventory.name, available: inventory.available })
    .from(inventory)
    .orderBy(asc(inventory.toolId))
})
