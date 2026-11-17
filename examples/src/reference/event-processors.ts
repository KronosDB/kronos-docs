import {
  batched,
  concurrent,
  deadLettering,
  emptyMetadata,
  eventHandler,
  eventProcessor,
  inMemoryDeadLetterQueue,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  polling,
  segmented,
  tagsOf,
  unitOfWork,
  withNamespace,
  type EventMessage,
  type Sequence,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

export const markRented = eventHandler(ToolRented, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) row.available = false
})

// Events written before any processor exists
const eventStore = inMemoryEventStore()

async function record(event: EventMessage) {
  await eventStore.append([event])
}

function toolAdded(toolId: string, model: string, name: string): EventMessage {
  const payload = { toolId, model, name }
  return {
    kind: "event",
    identifier: crypto.randomUUID(),
    name: ToolAdded.name,
    version: ToolAdded.version,
    payload,
    metadata: emptyMetadata(),
    timestamp: Date.now(),
    tags: tagsOf(ToolAdded, payload, emptyMetadata()),
  }
}

await record(toolAdded("t-1", "DCD791", "Cordless drill"))
await record(toolAdded("t-2", "D24000", "Tile saw"))

// A processor is a value: a name, a store to read, a token store and a unit of work
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

// Wrappers return a new value; they compose in any order
const byToolId: Sequence = (event) => event.tags.find((entry) => entry.key === "toolId")?.value ?? event.identifier

const tuned = polling(batched(inventoryView, 200), 250)
const sideBySide = concurrent(tuned, byToolId)
const parked = deadLettering(sideBySide, inMemoryDeadLetterQueue(), byToolId)
export const inventoryByTool = segmented(parked, 4, byToolId)

// Assembly: one processor value shared by the handlers delivered through it
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  eventHandlers: [
    { ...recordAddedTool, commandBus, queryBus, processor: inventoryView },
    { ...markRented, commandBus, queryBus, processor: inventoryView },
  ],
})

await new Promise((resolve) => setTimeout(resolve, 100))

const running = app.processors.get("inventory-view")!
console.log(running.status())
console.log([...inventory.values()])
await app.stop()
