import {
  commandHandler,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemorySchedulingEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type ScheduleCapableEventStore,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

// A command handler records the rental and arms its deadline in one task.
export const rentTool = commandHandler(
  RentTool,
  async ({ payload }, ctx: CommandHandlerContext<ScheduleCapableEventStore>) => {
    ctx.append(ToolRented, payload)
    await ctx.scheduleAfter(RentalOverdue, payload, SEVEN_DAYS)
  },
)

export const noteOverdue = eventHandler(RentalOverdue, ({ payload, timestamp }) => {
  console.log(`overdue: ${payload.toolId} with ${payload.customerId}, scheduled at ${timestamp}`)
})

/** The store the handlers use and the deadline fires into, its clock a week ahead so the deadline is due at once. */
const eventStore = inMemorySchedulingEventStore(inMemoryEventStore(), {
  clock: () => Date.now() + SEVEN_DAYS,
})
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const rentalDeadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...rentTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...noteOverdue, commandBus, queryBus, processor: rentalDeadlines }],
})

await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })
await new Promise((resolve) => setTimeout(resolve, 200))

await eventStore.stopScheduling()
await app.stop()
