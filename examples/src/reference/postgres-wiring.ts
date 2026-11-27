import {
  afterEvents,
  batched,
  commandHandler,
  deadLettering,
  eventHandler,
  eventProcessor,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  polling,
  snapshot,
  state,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type EventMessage,
  type ScheduleCapability,
} from "@kronos-ts/core"
import {
  postgresDeadLetterQueue,
  postgresEventStore,
  postgresPool,
  postgresSchedulingEventStore,
  postgresSnapshottingEventStore,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { z } from "zod"

const ns = withNamespace("toolstore")

const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
await pg.start()

// Every unit of work the buses and processors mint carries a Postgres transaction.
const uow = postgresUnitOfWork(unitOfWork, pg)

// The log, then snapshots around it, then scheduling around that.
const eventStore = postgresSchedulingEventStore(
  postgresSnapshottingEventStore(postgresEventStore(pg), pg, jsonSerializer()),
  pg,
  uow,
)
const tokenStore = postgresTokenStore(pg, { claimTimeoutMs: 20_000 })
const deadLetters = postgresDeadLetterQueue(pg, { maxSequences: 256, maxSequenceSize: 64 })

// Commands run in the transactional factory. Queries run in the plain one.
const commandBus = localCommandBus(uow)
const queryBus = localQueryBus(unitOfWork)

const byTool = (event: EventMessage) => (event.payload as { toolId?: string }).toolId ?? event.identifier

const inventoryView = deadLettering(
  batched(eventProcessor("inventory-view", eventStore, tokenStore, uow), 200),
  deadLetters,
  byTool,
)

// A state that caches its fold: every 100 events, under the key "renting-v1".
const Renting = snapshot(
  state({
    id: { toolId: z.string() },
    tags: (id) => ({ toolId: id.toolId }),
    evolve: [
      () => ({ rentals: 0 }),
      [ToolRented, (renting) => ({ rentals: renting.rentals + 1 })],
    ],
  }),
  "renting-v1",
  afterEvents(100),
)

// Arm a deadline: a RentalOverdue event that appears in the log in seven days.
const rentTool = commandHandler(
  RentTool,
  async ({ payload }, ctx: CommandHandlerContext & ScheduleCapability) => {
    await ctx.load(Renting, { toolId: payload.toolId })
    ctx.append(ToolRented, payload)
    await ctx.scheduleAfter(RentalOverdue, payload, 7 * 24 * 60 * 60 * 1000)
  },
)

const markRented = eventHandler(ToolRented, async () => {})

export const app = kronos({
  commandHandlers: [{ ...rentTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...markRented, commandBus, queryBus, processor: inventoryView }],
})

// kronos() does not start the scheduling worker: tune it by wrapping the store, then start it.
const scheduler = polling(batched(eventStore, 100), 250)
await scheduler.startScheduling()

// On shutdown, in this order.
await scheduler.stopScheduling()
await pg.close()
