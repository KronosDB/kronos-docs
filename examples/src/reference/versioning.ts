import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  upcast,
  upcastingEventStore,
  withNamespace,
  type EventMessage,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

// The shape in the log: every ToolAdded written before tools had a category.
export const ToolAddedV1 = ns.event("ToolAdded", {
  version: "1.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

// The shape the code uses today.
export const ToolAdded = ns.event("ToolAdded", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string(), category: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const addCategory = upcast(ToolAddedV1, ToolAdded, (payload) => ({ ...payload, category: "uncategorized" }))

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  console.log(`${payload.toolId} ${payload.name} (${payload.category})`)
})

const log = inMemoryEventStore()
const eventStore = upcastingEventStore(log, [addCategory])

// A ToolAdded as it was stored when the version was 1.0.
const stored: EventMessage = {
  kind: "event",
  identifier: "e-1",
  name: ToolAddedV1.name,
  version: ToolAddedV1.version,
  payload: { toolId: "t-1", model: "DCD791", name: "Cordless drill" },
  metadata: {},
  timestamp: 1_700_000_000_000,
}
await log.append([{ event: stored, tags: [{ key: "toolId", value: "t-1" }] }])

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
})

await new Promise((resolve) => setTimeout(resolve, 200))

const raw = await log.source({ query: { tags: { toolId: "t-1" } } })
const read = await eventStore.source({ query: { tags: { toolId: "t-1" } } })
console.log(raw.events[0]?.version, raw.events[0]?.payload)
console.log(read.events[0]?.version, read.events[0]?.payload)

await app.stop()
