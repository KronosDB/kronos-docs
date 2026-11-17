import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemorySchedulingEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
  type EventHandlerContext,
  type ScheduleCapability,
  type SubscriptionCapability,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

const rentalPeriodMs = 7 * 24 * 60 * 60 * 1000

// A handler that schedules an event names the capability it needs
export const scheduleDeadline = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & ScheduleCapability) => {
    await ctx.scheduleAfter(RentalOverdue, payload, rentalPeriodMs)
  },
)

// A handler that pushes to subscription queries names its capability the same way
export const pushRentedTool = eventHandler(
  ToolRented,
  ({ payload }, ctx: EventHandlerContext & SubscriptionCapability) => {
    ctx.emitUpdate(GetInventory, () => true, [{ toolId: payload.toolId, name: "", available: false }])
  },
)

// The entry decides what the context has: a scheduling log and a subscription bus
const eventStore = inMemorySchedulingEventStore(inMemoryEventStore())
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const rentalDeadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [
    { ...scheduleDeadline, eventStore, commandBus, queryBus, processor: rentalDeadlines },
    { ...pushRentedTool, eventStore, commandBus, queryBus, processor: rentalDeadlines },
  ],
})

await app.stop()
