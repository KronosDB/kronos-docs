import type { EventProcessor, Sequence } from "@kronos-ts/core"
import { addTool } from "../../toolstore/slices/toolstore/add-tool"
import { inventory } from "../../toolstore/slices/toolstore/inventory"
import { registerCustomer } from "../../toolstore/slices/toolstore/register-customer"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { confirmRental } from "./confirm-rental"
import type { Notifications } from "./confirm-rental/notifications"
import { requestService } from "./request-service"
import { sendReceipt } from "./send-receipt"
import type { Receipts } from "./send-receipt/receipts"

// The outside systems' clients, built once for every slice that uses them. Until real systems are chosen, these send
// nothing; replace one here and every slice that uses it gets the real one.
const notifications: Notifications = { send: async () => {} }
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
  confirmRental(notifications, eventProcessor, deadLettering),
  sendReceipt(receipts, eventProcessor, deadLettering),
  requestService(eventProcessor),
]
