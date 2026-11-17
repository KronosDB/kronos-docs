import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  qn,
  unitOfWork,
  upcastingEventStore,
  withNamespace,
  type EventMessage,
  type Upcast,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

// What the log holds from before the event was renamed.
const storedName = qn("toolstore", "RentalOverdue")

// What the code calls it today.
export const RentalLapsed = ns.event("RentalLapsed", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const lapsedRentals: Upcast = (event) =>
  event.name.namespace === storedName.namespace && event.name.name === storedName.name
    ? { ...event, name: RentalLapsed.name, version: RentalLapsed.version }
    : event

export const storedTypes = (type: string) =>
  type === "toolstore.RentalLapsed" ? [type, "toolstore.RentalOverdue"] : [type]

export const noteLapsed = eventHandler(RentalLapsed, ({ payload }) => {
  console.log(`lapsed: ${payload.toolId} with ${payload.customerId}`)
})

const log = inMemoryEventStore()
const eventStore = upcastingEventStore(log, lapsedRentals, { storedTypes })

const old: EventMessage = {
  kind: "event",
  identifier: "e-1",
  name: storedName,
  version: "1.0",
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: {},
  timestamp: 1_700_000_000_000,
  tags: [
    { key: "toolId", value: "t-1" },
    { key: "customerId", value: "ada" },
  ],
}
await log.append([old])

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const rentalDeadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...noteLapsed, commandBus, queryBus, processor: rentalDeadlines }],
})

await new Promise((resolve) => setTimeout(resolve, 200))
await app.stop()
