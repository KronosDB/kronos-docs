import {
  afterEvents,
  commandHandler,
  inMemoryEventStore,
  inMemorySnapshottingEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  snapshot,
  snapshotIdentifier,
  sourcingCondition,
  state,
  unitOfWork,
  whenSourcingTimeExceeds,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

export const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

const CustomerRentalsHistory = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ rented: 0, returned: 0 }),
    [ToolRented, (history) => ({ ...history, rented: history.rented + 1 })],
    [ToolReturned, (history) => ({ ...history, returned: history.returned + 1 })],
  ],
})

export const CustomerHistory = snapshot(
  CustomerRentalsHistory,
  "customer-history-v1",
  afterEvents(100),
)

// Either condition makes a snapshot due.
export const CustomerHistoryOrSlow = snapshot(
  CustomerRentalsHistory,
  "customer-history-slow-v1",
  (result) => afterEvents(100)(result) || whenSourcingTimeExceeds(50)(result),
)

export const returnTool = commandHandler(ReturnTool, async ({ payload }, ctx) => {
  const history = await ctx.load(CustomerHistory, { customerId: payload.customerId })
  if (history.rented === history.returned) throw new Error("nothing to return")
  ctx.append(ToolReturned, payload)
})

// The log, wrapped once at the composition root.
const eventStore = inMemorySnapshottingEventStore(inMemoryEventStore())
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [{ ...returnTool, eventStore, commandBus, queryBus }],
})

if (import.meta.main) {
  const rentals = Array.from({ length: 150 }, (_, index) => ({
    event: {
      kind: "event" as const,
      identifier: `rented-${index}`,
      name: ToolRented.name,
      version: ToolRented.version,
      payload: { toolId: `t-${index}`, customerId: "ada" },
      metadata: {},
      timestamp: Date.now(),
    },
    tags: [
      { key: "toolId", value: `t-${index}` },
      { key: "customerId", value: "ada" },
    ],
  }))
  await eventStore.append(rentals)

  await send(commandBus, ReturnTool, { toolId: "t-0", customerId: "ada" })
  await new Promise((resolve) => setTimeout(resolve, 20))

  const key = `customer-history-v1:${snapshotIdentifier({ customerId: "ada" })}`
  const cached = await eventStore.source(
    sourcingCondition(CustomerHistory.query({ customerId: "ada" }), undefined, { key }),
  )
  console.log(cached.snapshot, cached.events.length)

  await app.stop()
}
