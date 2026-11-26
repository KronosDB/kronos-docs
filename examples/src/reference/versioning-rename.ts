import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  upcast,
  upcastingEventStore,
  withNamespace,
  type EventMessage,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

// What the log holds from before the event was renamed.
export const RentalOverdue = ns.event("RentalOverdue", {
  version: "1.0",
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

// What the code calls it today.
export const RentalLapsed = ns.event("RentalLapsed", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const lapsedRentals = upcast(RentalOverdue, RentalLapsed, (payload) => payload)

export const noteLapsed = eventHandler(RentalLapsed, ({ payload }) => {
  console.log(`lapsed: ${payload.toolId} with ${payload.customerId}`)
})

const log = inMemoryEventStore()
const eventStore = upcastingEventStore(log, [lapsedRentals])

const old: EventMessage = {
  kind: "event",
  identifier: "e-1",
  name: RentalOverdue.name,
  version: "1.0",
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: {},
  timestamp: 1_700_000_000_000,
}
await log.append([
  {
    event: old,
    tags: [
      { key: "toolId", value: "t-1" },
      { key: "customerId", value: "ada" },
    ],
  },
])

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const rentalDeadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...noteLapsed, commandBus, queryBus, processor: rentalDeadlines }],
})

await new Promise((resolve) => setTimeout(resolve, 200))
await app.stop()
