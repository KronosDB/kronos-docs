import { batched, concurrent, type EventMessage, type EventProcessor, type Sequence } from "@kronos-ts/core"
import { automation } from "./automation"
import { handle } from "./handler"
import type { Receipts } from "./receipts"

/** The rentals of one customer stay in order; different customers' receipts are sent side by side. */
const byCustomer = (event: EventMessage) =>
  (event.payload as { customerId?: string }).customerId ?? event.identifier

export const sendReceipt = (
  receipts: Receipts,
  eventProcessor: (name: string) => EventProcessor,
  deadLettering: (processor: EventProcessor, sequence: Sequence) => EventProcessor,
) => {
  // Named for what it does. A new name would send a receipt for every rental in the log again.
  const processor = deadLettering(concurrent(batched(eventProcessor("send-receipt"), 100), byCustomer), byCustomer)
  return {
    commandHandlers: [handle(receipts)],
    queryHandlers: [],
    eventHandlers: automation.map((handler) => ({ ...handler, processor })),
  }
}
