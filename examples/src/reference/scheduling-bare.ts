import {
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type ScheduleCapableEventStore,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const rentTool = commandHandler(
  RentTool,
  async ({ payload }, ctx: CommandHandlerContext<ScheduleCapableEventStore>) => {
    await ctx.scheduleAfter(RentalOverdue, payload, 7 * 24 * 60 * 60 * 1000)
  },
)

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

kronos({
  // @ts-expect-error the entry's event store was never wrapped, so it cannot schedule
  commandHandlers: [{ ...rentTool, eventStore: inMemoryEventStore(), commandBus, queryBus }],
})

export const plain = commandHandler(RentTool, async (_command, ctx) => {
  // @ts-expect-error a context over a bare event store has no scheduleAfter
  await ctx.scheduleAfter(RentalOverdue, { toolId: "t-1", customerId: "ada" }, 1000)
})
