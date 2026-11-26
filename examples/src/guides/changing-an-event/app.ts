import {
  emptyMetadata,
  eventProcessor,
  generateIdentifier,
  inMemoryEventStore,
  inMemorySnapshottingEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  tagsOf,
  unitOfWork,
  upcastingEventStore,
  type TaggedEvent,
} from "@kronos-ts/core"
import { z } from "zod"
import { AddTool, GetInventory, ToolAddedV1 } from "./descriptors.js"
import { addTool, getInventory, recordAddedTool } from "./toolstore.js"
import { categoryAdded } from "./upcast.js"
import { waitFor } from "./wait-for.js"

// Events as they were stored before the change, in the 1.0 shape.
function storedBeforeTheChange(payload: z.output<typeof ToolAddedV1.payload>): TaggedEvent {
  const event = {
    kind: "event" as const,
    identifier: generateIdentifier(),
    name: ToolAddedV1.name,
    version: ToolAddedV1.version,
    payload,
    metadata: emptyMetadata(),
    timestamp: Date.now(),
  }
  return { event, tags: tagsOf(ToolAddedV1, payload, emptyMetadata()) }
}

const log = inMemoryEventStore()
await log.append([
  storedBeforeTheChange({ toolId: "t-1", model: "DCD791", name: "Cordless drill" }),
  storedBeforeTheChange({ toolId: "t-2", model: "D24000", name: "Tile saw" }),
])

const eventStore = upcastingEventStore(inMemorySnapshottingEventStore(log), [categoryAdded])

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
  queryHandlers: [{ ...getInventory, queryBus }],
})

await send(commandBus, AddTool, { toolId: "t-3", model: "DWE7491", name: "Table saw", category: "saws" })

const tools = await waitFor(() => query(queryBus, GetInventory, {}), (rows) => rows.length === 3)
for (const tool of tools) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.category}`)
}

const asStored = await log.source({ query: { tags: { toolId: "t-1" } } })
const asRead = await eventStore.source({ query: { tags: { toolId: "t-1" } } })
for (const [label, source] of [["stored", asStored], ["read", asRead]] as const) {
  for (const event of source.events) console.log(`${label.padEnd(6)}  ${event.version}  ${JSON.stringify(event.payload)}`)
}

await app.stop()
