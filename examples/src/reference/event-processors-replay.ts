import {
  eventHandler,
  eventProcessor,
  emptyMetadata,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  tagsOf,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()
const announcements: string[] = []

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }, ctx) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
  if (!ctx.isReplay()) announcements.push(`new tool: ${payload.name}`)
})

const eventStore = inMemoryEventStore()
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
})

async function addTool(toolId: string, model: string, name: string) {
  const payload = { toolId, model, name }
  await eventStore.append([
    {
      event: {
        kind: "event",
        identifier: crypto.randomUUID(),
        name: ToolAdded.name,
        version: ToolAdded.version,
        payload,
        metadata: emptyMetadata(),
        timestamp: Date.now(),
      },
      tags: tagsOf(ToolAdded, payload, emptyMetadata()),
    },
  ])
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 100))

await addTool("t-1", "DCD791", "Cordless drill")
await addTool("t-2", "D24000", "Tile saw")
await wait()

// Stop the processor, clear what its handlers wrote, and start again from the first event
const processor = app.processors.get("inventory-view")!
await processor.stop()
await processor.resetTokens(0n, () => {
  inventory.clear()
})
console.log(`replaying: ${processor.replaying}, position: ${processor.position}`)

await processor.start()
await addTool("t-3", "DWE7491", "Table saw")
await wait()

console.log(processor.status())
console.log([...inventory.keys()])
console.log(announcements)
await app.stop()
