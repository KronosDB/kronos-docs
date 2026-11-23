import type { EventProcessor, Sequence } from "@kronos-ts/core"
import { addTool } from "../../toolstore/slices/toolstore/add-tool"
import { inventory } from "../../toolstore/slices/toolstore/inventory"
import { registerCustomer } from "../../toolstore/slices/toolstore/register-customer"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { sendReceipt } from "./send-receipt"
import type { Receipts } from "./send-receipt/receipts"

// The receipts system's client, built once for every slice that uses it. Until a real system is chosen, this one
// sends nothing; replace it here and every slice that sends receipts uses the real one.
const receipts: Receipts = { send: async () => {} }

/** The context's slices. A slice that is not listed here does not run. */
export const toolstore = (
  eventProcessor: (name: string) => EventProcessor,
  deadLettering: (processor: EventProcessor, sequence: Sequence) => EventProcessor,
) => [
  addTool(),
  registerCustomer(),
  rentTool(),
  inventory(eventProcessor),
  sendReceipt(receipts, eventProcessor, deadLettering),
]
