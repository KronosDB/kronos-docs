import {
  commandHandler,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  queryHandler,
  state,
  unitOfWork,
  withNamespace,
  type EventHandlerContext,
  type ScheduleCapability,
} from "@kronos-ts/core"
import { advanceableClock, recordingCommandBus, recordingEventStore } from "@kronos-ts/test"
import { z } from "zod"
import { registerCustomer } from "../start/customer"
import { rentTool } from "../start/renting"
import { AddTool, GetInventory, ToolAdded, ToolRented } from "../start/messages"

// Adding a tool again is a retry, but an id that already names another model is a bug in the caller.
const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    (): { added: false } | { added: true; model: string } => ({ added: false }),
    [ToolAdded, (_tool, { payload }) => ({ added: true, model: payload.model })],
  ],
})

const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.added && tool.model !== payload.model) throw new Error(`tool ${payload.toolId} is already a ${tool.model}`)
  if (!tool.added) ctx.append(ToolAdded, payload)
  return { ok: true }
})

export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

const ns = withNamespace("toolstore")

export const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const armOverdue = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & ScheduleCapability) => {
    await ctx.scheduleAfter(RentalOverdue, payload, SEVEN_DAYS)
  },
)

export function toolStore() {
  const clock = advanceableClock()
  const uow = () => unitOfWork(clock)
  const eventStore = recordingEventStore(inMemoryEventStore(), { clock })
  const commandBus = recordingCommandBus(localCommandBus(uow))
  const queryBus = localQueryBus(uow)
  const deadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), uow)
  const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), uow)

  const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()
  const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
    inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
  })
  const recordRentedTool = eventHandler(ToolRented, ({ payload }) => {
    const row = inventory.get(payload.toolId)
    if (row) inventory.set(payload.toolId, { ...row, available: false })
  })
  const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

  return kronos({
    commandHandlers: [
      { ...addTool, eventStore, commandBus, queryBus },
      { ...registerCustomer, eventStore, commandBus, queryBus },
      { ...rentTool, eventStore, commandBus, queryBus },
    ],
    eventHandlers: [
      { ...armOverdue, eventStore, commandBus, queryBus, processor: deadlines },
      { ...recordAddedTool, commandBus, queryBus, processor: inventoryView },
      { ...recordRentedTool, commandBus, queryBus, processor: inventoryView },
    ],
    queryHandlers: [{ ...getInventory, queryBus }],
  })
}
