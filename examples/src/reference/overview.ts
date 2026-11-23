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

// Messages
export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

// State
export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

// Command handler
export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) return
  ctx.append(ToolAdded, payload)
})

// Event handler and the read model it keeps
const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

// Query handler
export const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

// Assembly
const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
  queryHandlers: [{ ...getInventory, queryBus }],
})

// Use
await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
const tools = await query(queryBus, GetInventory, {})

await app.stop()
console.log(tools)
