import type { EventProcessor } from "@kronos-ts/core"
import { toolstore } from "./toolstore"

/**
 * The app's handlers: each list is the sum of its contexts' lists of that kind, the way a context sums its slices'.
 * A context that is not spread here does not run.
 */
export const handlers = (eventProcessor: (name: string) => EventProcessor) => {
  const toolstoreHandlers = toolstore(eventProcessor)
  return {
    commandHandlers: [...toolstoreHandlers.commandHandlers],
    queryHandlers: [...toolstoreHandlers.queryHandlers],
    eventHandlers: [...toolstoreHandlers.eventHandlers],
  }
}
