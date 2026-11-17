import {
  commandHandler,
  inMemoryEventStore,
  is,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  result: z.object({ rented: z.boolean() }),
})

const MAX_RENTALS = 2

export const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const events = await ctx.source({
    tags: { customerId: payload.customerId },
    types: [ToolRented, ToolReturned],
  })
  const rented = events.filter((event) => is(event, ToolRented)).length
  const returned = events.filter((event) => is(event, ToolReturned)).length
  if (rented - returned >= MAX_RENTALS) return { rented: false }
  ctx.append(ToolRented, payload)
  return { rented: true }
})

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [{ ...rentTool, eventStore, commandBus, queryBus }],
})

if (import.meta.main) {
  for (const toolId of ["t-1", "t-2", "t-3"]) {
    console.log(toolId, await send(commandBus, RentTool, { toolId, customerId: "ada" }))
  }
  await app.stop()
}
