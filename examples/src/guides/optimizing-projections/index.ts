import { batched, concurrent, type EventProcessor, segmented } from "@kronos-ts/core"
import { pipe } from "../../toolstore/pipe"
import { handle } from "../../toolstore/slices/toolstore/inventory/handler"
import { byTool, projection } from "./projection"

export const inventory = (eventProcessor: (name: string) => EventProcessor) => {
  const processor = pipe(
    eventProcessor("inventory-view"),
    (inventoryView) => batched(inventoryView, 1000),
    (inventoryView) => concurrent(inventoryView, byTool),
  )
  return {
    commandHandlers: [],
    queryHandlers: [handle],
    eventHandlers: projection.map((handler) => ({ ...handler, processor })),
  }
}

/** The same inventory in four segments: four batches, transactions and positions side by side. */
export const segmentedInventory = (eventProcessor: (name: string) => EventProcessor) => {
  const processor = pipe(
    eventProcessor("inventory-view"),
    (inventoryView) => batched(inventoryView, 1000),
    (inventoryView) => concurrent(inventoryView, byTool),
    (inventoryView) => segmented(inventoryView, 4, byTool),
  )
  return {
    commandHandlers: [],
    queryHandlers: [handle],
    eventHandlers: projection.map((handler) => ({ ...handler, processor })),
  }
}
