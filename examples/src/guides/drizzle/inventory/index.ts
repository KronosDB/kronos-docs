import { batched, type EventProcessor } from "@kronos-ts/core"
import { pipe } from "../../../toolstore/pipe"
import { drizzleHandler } from "../drizzle"
import { handle } from "./handler"
import { projection } from "./projection"

export const inventory = (eventProcessor: (name: string) => EventProcessor) => {
  const processor = batched(eventProcessor("inventory-view"), 100)
  return {
    commandHandlers: [],
    queryHandlers: [{ ...handle, handler: pipe(handle.handler, drizzleHandler) }],
    eventHandlers: projection.map((handler) => ({ ...handler, handler: pipe(handler.handler, drizzleHandler), processor })),
  }
}
