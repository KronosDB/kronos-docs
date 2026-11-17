import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const markRented = eventHandler(ToolRented, () => {})

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...markRented, commandBus, queryBus, processor: inventoryView }],
})

// Healthy when every processor runs and none holds an unrecovered error.
export async function health() {
  const head = await eventStore.getHeadPosition()
  const processors = [...app.processors.values()].map((processor) => {
    const status = processor.status()
    return {
      name: processor.name,
      running: status.running,
      error: status.error?.message,
      lag: head - status.position,
      caughtUp: status.caughtUp,
    }
  })
  const ok = processors.every((processor) => processor.running && processor.error === undefined)
  return { status: ok ? 200 : 503, processors }
}

console.log(await health())
await app.stop()
