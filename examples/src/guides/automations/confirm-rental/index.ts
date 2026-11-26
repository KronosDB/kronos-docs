import { batched, concurrent, type EventMessage, type EventProcessor, type Sequence } from "@kronos-ts/core"
import { automation } from "./automation"
import type { Notifications } from "./notifications"

/** The rentals of one customer stay in order; different customers are notified side by side. */
const byCustomer = (event: EventMessage) =>
  (event.payload as { customerId?: string }).customerId ?? event.identifier

export const confirmRental = (
  notifications: Notifications,
  eventProcessor: (name: string) => EventProcessor,
  deadLettering: (processor: EventProcessor, sequence: Sequence) => EventProcessor,
) => {
  // Named for what it does. A new name would notify every customer in the log again.
  const processor = deadLettering(concurrent(batched(eventProcessor("confirm-rental"), 100), byCustomer), byCustomer)
  return {
    commandHandlers: [],
    queryHandlers: [],
    eventHandlers: automation(notifications).map((handler) => ({ ...handler, processor })),
  }
}
