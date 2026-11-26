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

/**
 * The context's handlers: each list is the sum of its slices' lists of that kind. A slice that is not spread here does
 * not run. A slice that builds a processor is called once, so its lists share that processor.
 */
export const toolstore = (
  eventProcessor: (name: string) => EventProcessor,
  deadLettering: (processor: EventProcessor, sequence: Sequence) => EventProcessor,
) => {
  const inventoryView = inventory(eventProcessor)
  const confirmation = confirmRental(notifications, eventProcessor, deadLettering)
  const receipt = sendReceipt(receipts, eventProcessor, deadLettering)
  const service = requestService(eventProcessor)
  return {
    commandHandlers: [
      ...addTool().commandHandlers,
      ...registerCustomer().commandHandlers,
      ...rentTool().commandHandlers,
      ...receipt.commandHandlers,
      ...service.commandHandlers,
    ],
    queryHandlers: [...inventoryView.queryHandlers],
    eventHandlers: [
      ...inventoryView.eventHandlers,
      ...confirmation.eventHandlers,
      ...receipt.eventHandlers,
      ...service.eventHandlers,
    ],
  }
}
