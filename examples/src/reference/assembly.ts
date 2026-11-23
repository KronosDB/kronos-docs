import {
  commandHandler,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  queryHandler,
  send,
  state,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string() })),
})

export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [() => ({ exists: false }), [ToolAdded, (tool) => ({ ...tool, exists: true })]],
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) return
  ctx.append(ToolAdded, payload)
})

const inventory = new Map<string, { toolId: string; name: string }>()
const counts = { added: 0 }

export const recordTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name })
})

export const countTools = eventHandler(ToolAdded, () => {
  counts.added += 1
})

export const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

// Shared infrastructure, created once at the composition root
const eventStore = inMemoryEventStore()
const tokenStore = inMemoryTokenStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, tokenStore, unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, name: "add-tool", eventStore, commandBus, queryBus }],
  queryHandlers: [{ ...getInventory, queryBus }],
  eventHandlers: [
    { ...recordTool, commandBus, queryBus, processor: inventoryView },
    { ...countTools, commandBus, queryBus, processor: inventoryView },
  ],
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await new Promise((resolve) => setTimeout(resolve, 200))
console.log(await query(queryBus, GetInventory, {}), counts)

// What the app reports
console.log([...app.processors.keys()])
console.log(app.eventStores.size, app.commandBuses.size, app.queryBuses.size)
console.log(app.processors.get("inventory-view")?.status().running)

await app.stop()
console.log(app.processors.get("inventory-view")?.running)
