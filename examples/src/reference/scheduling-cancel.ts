import {
  commandHandler,
  inMemoryEventStore,
  inMemorySchedulingEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type ScheduleCapableEventStore,
  type ScheduleToken,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

// Stands in for a table that keeps the token next to the rental.
const deadlines = new Map<string, ScheduleToken>()

export const rentTool = commandHandler(
  RentTool,
  async ({ payload }, ctx: CommandHandlerContext<ScheduleCapableEventStore>) => {
    ctx.append(ToolRented, payload)
    const token = await ctx.scheduleAfter(RentalOverdue, payload, SEVEN_DAYS)
    deadlines.set(payload.toolId, token)
  },
)

export const returnTool = commandHandler(
  ReturnTool,
  async ({ payload }, ctx: CommandHandlerContext<ScheduleCapableEventStore>) => {
    ctx.append(ToolReturned, payload)
    const token = deadlines.get(payload.toolId)
    if (token === undefined) return
    const outcome = await ctx.cancelSchedule(token)
    if (outcome.kind === "already-appended") console.log("the deadline already fired")
    if (outcome.kind === "cancelled") deadlines.delete(payload.toolId)
  },
)

const eventStore = inMemorySchedulingEventStore(inMemoryEventStore())
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [
    { ...rentTool, eventStore, commandBus, queryBus },
    { ...returnTool, eventStore, commandBus, queryBus },
  ],
})

await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })
await send(commandBus, ReturnTool, { toolId: "t-1", customerId: "ada" })

await eventStore.stopScheduling()
await app.stop()
