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

// Messages

const ns = withNamespace("toolstore")

const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), name: z.string() }),
  result: z.object({ ok: z.literal(true) }),
})

const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  result: z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), rejection: z.literal("TOOL_UNAVAILABLE"), toolId: z.string() }),
  ]),
})

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

// Decisions

const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    (): { added: boolean; rentedBy: string[] } => ({ added: false, rentedBy: [] }),
    [ToolAdded, (tool) => ({ ...tool, added: true })],
    [ToolRented, (tool, { payload }) => ({ ...tool, rentedBy: [...tool.rentedBy, payload.customerId] })],
  ],
})

const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (!tool.added) ctx.append(ToolAdded, payload)
  return { ok: true }
})

const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.rentedBy.includes(payload.customerId)) return { ok: true }
  if (!tool.added || tool.rentedBy.length > 0) return { ok: false, rejection: "TOOL_UNAVAILABLE", toolId: payload.toolId }
  ctx.append(ToolRented, payload)
  return { ok: true }
})

// The inventory

const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

const recordRentedTool = eventHandler(ToolRented, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) inventory.set(payload.toolId, { ...row, available: false })
})

const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

// The application

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [
    { ...addTool, eventStore, commandBus, queryBus },
    { ...rentTool, eventStore, commandBus, queryBus },
  ],
  eventHandlers: [
    { ...recordAddedTool, commandBus, queryBus, processor: inventoryView },
    { ...recordRentedTool, commandBus, queryBus, processor: inventoryView },
  ],
  queryHandlers: [{ ...getInventory, queryBus }],
})

// Using it

await send(commandBus, AddTool, { toolId: "t-1", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", name: "Tile saw" })

for (const [toolId, customerId] of [["t-1", "ada"], ["t-1", "ada"], ["t-1", "grace"]] as const) {
  const outcome = await send(commandBus, RentTool, { toolId, customerId })
  console.log(`${customerId} rents ${toolId}: ${outcome.ok ? "rented" : outcome.rejection}`)
}

// Event handlers run after a command returns, so wait until the processor has reached the end of the log.
while (app.processors.get("inventory-view")!.position < (await eventStore.getHeadPosition())) {
  await new Promise((resolve) => setTimeout(resolve, 5))
}
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await app.stop()
