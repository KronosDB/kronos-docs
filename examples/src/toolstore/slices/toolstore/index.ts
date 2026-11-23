import type { EventProcessor } from "@kronos-ts/core"
import { addTool } from "./add-tool"
import { inventory } from "./inventory"
import { registerCustomer } from "./register-customer"
import { rentTool } from "./rent-tool"

/** The context's slices. A slice that is not listed here does not run. */
export const toolstore = (eventProcessor: (name: string) => EventProcessor) => [
  addTool(),
  registerCustomer(),
  rentTool(),
  inventory(eventProcessor),
]
