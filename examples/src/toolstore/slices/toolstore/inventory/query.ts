import { z } from "zod"
import { ns } from "../events"

export const InventoryRow = z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })
export type InventoryRow = z.infer<typeof InventoryRow>

/** Every tool in the store, and whether it is on the shelf. */
export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(InventoryRow),
})
