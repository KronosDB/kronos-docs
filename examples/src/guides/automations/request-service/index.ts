import { batched, concurrent, type EventMessage, type EventProcessor } from "@kronos-ts/core"
import { automation } from "./automation"
import { handle } from "./handler"

/** The rentals of one tool stay in order; different tools are counted side by side. */
const byTool = (event: EventMessage) => event.tags.find((tag) => tag.key === "toolId")?.value ?? event.identifier

export const requestService = (eventProcessor: (name: string) => EventProcessor) => {
  // Named for what it does. A new name would count every rental in the log again.
  const processor = concurrent(batched(eventProcessor("request-service"), 100), byTool)
  return {
    commandHandlers: [handle],
    queryHandlers: [],
    eventHandlers: automation.map((handler) => ({ ...handler, processor })),
  }
}
