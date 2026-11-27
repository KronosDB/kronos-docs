import type { EventProcessor } from "@kronos-ts/core"
import { addTool } from "./add-tool"
import { inventory } from "./inventory"
import { registerCustomer } from "./register-customer"
import { rentTool } from "./rent-tool"

/**
 * The context's handlers: each list is the sum of its slices' lists of that kind. A slice that is not spread here does
 * not run. A slice that builds a processor is called once, so its lists share that processor.
 */
export const toolstore = (eventProcessor: (name: string) => EventProcessor) => {
  const inventoryView = inventory(eventProcessor)
  return {
    commandHandlers: [...addTool().commandHandlers, ...registerCustomer().commandHandlers, ...rentTool().commandHandlers],
    queryHandlers: [...inventoryView.queryHandlers],
    eventHandlers: [...inventoryView.eventHandlers],
  }
}
