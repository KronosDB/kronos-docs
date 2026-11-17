import {
  eventHandler,
  eventProcessor,
  inMemoryTokenStore,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  queryHandler,
  subscriptionQuery,
  unitOfWork,
  withNamespace,
  type EventHandlerContext,
  type SubscriptionCapability,
} from "@kronos-ts/core"
import { kronosDbConnection, kronosDbEventStore, kronosDbQueryBus } from "@kronos-ts/kronosdb"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const GetCustomerRentals = ns.query("GetCustomerRentals", {
  payload: z.object({ customerId: z.string() }),
  result: z.array(z.string()),
})

const rentals = new Map<string, string[]>()

export const getCustomerRentals = queryHandler(
  GetCustomerRentals,
  ({ payload }) => rentals.get(payload.customerId) ?? [],
)

export const recordRental = eventHandler(
  ToolRented,
  ({ payload }, ctx: EventHandlerContext & SubscriptionCapability) => {
    const toolIds = [...(rentals.get(payload.customerId) ?? []), payload.toolId]
    rentals.set(payload.customerId, toolIds)
    ctx.emitUpdate(GetCustomerRentals, (subscribed) => subscribed.customerId === payload.customerId, toolIds)
  },
)

const kdb = await kronosDbConnection({ componentName: "toolstore-counter", serializer: jsonSerializer() })
const eventStore = kronosDbEventStore(kdb, "toolstore")
const commandBus = localCommandBus(unitOfWork)
const queryBus = kronosDbQueryBus(localQueryBus(unitOfWork), kdb, "toolstore")
const customerRentals = eventProcessor("customer-rentals", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  queryHandlers: [{ ...getCustomerRentals, queryBus }],
  eventHandlers: [{ ...recordRental, eventStore, commandBus, queryBus, processor: customerRentals }],
})
await kdb.start()

const watching = subscriptionQuery(queryBus, GetCustomerRentals, { customerId: "ada" })
console.log("initial:", await watching.initialResult)

for await (const toolIds of watching.updates) {
  console.log("rented now:", toolIds)
  break
}

watching.close()
await app.stop()
await kdb.close()
