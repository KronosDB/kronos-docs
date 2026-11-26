import { batched, type EventProcessor } from "@kronos-ts/core"
import { handle } from "./handler"
import { projection } from "./projection"

export const inventory = (eventProcessor: (name: string) => EventProcessor) => {
  // Named for the table it writes. A batch of up to 100 events commits in one transaction with the position.
  const processor = batched(eventProcessor("inventory-view"), 100)
  return {
    commandHandlers: [],
    queryHandlers: [handle],
    eventHandlers: projection.map((handler) => ({ ...handler, processor })),
  }
}
