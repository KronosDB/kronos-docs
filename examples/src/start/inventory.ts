import { eventHandler, queryHandler } from "@kronos-ts/core"
import { GetInventory, ToolAdded, ToolRented } from "./messages"

const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

export const recordRentedTool = eventHandler(ToolRented, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) inventory.set(payload.toolId, { ...row, available: false })
})

export const getInventory = queryHandler(GetInventory, () => [...inventory.values()])
