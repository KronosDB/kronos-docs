import { eventHandler, queryHandler, withNamespace } from "@kronos-ts/core"
import { z } from "zod"
import { ToolAdded } from "./add-tool"
import { ToolRented } from "./rent-tool"
import { slice } from "./slice"

const ns = withNamespace("toolstore")

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

const recordRentedTool = eventHandler(ToolRented, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) inventory.set(payload.toolId, { ...row, available: false })
})

const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

export const inventorySlice = slice({
  queryHandlers: [getInventory],
  eventHandlers: [
    { processor: "inventory-view", handler: recordAddedTool },
    { processor: "inventory-view", handler: recordRentedTool },
  ],
})
