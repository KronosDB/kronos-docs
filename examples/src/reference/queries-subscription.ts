import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  payloadEquals,
  commandHandler,
  queryHandler,
  send,
  subscriptionQuery,
  unitOfWork,
  withNamespace,
  type EventHandlerContext,
  type SubscriptionCapability,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

export const GetCustomerRentals = ns.query("GetCustomerRentals", {
  payload: z.object({ customerId: z.string() }),
  result: z.array(z.string()),
})

const rentals = new Map<string, string[]>()

export const rentTool = commandHandler(RentTool, ({ payload }, ctx) => {
  ctx.append(ToolRented, payload)
})

export const getCustomerRentals = queryHandler(
  GetCustomerRentals,
  ({ payload }) => rentals.get(payload.customerId) ?? [],
)

export const recordRental = eventHandler(
  ToolRented,
  ({ payload }, ctx: EventHandlerContext & SubscriptionCapability) => {
    const toolIds = [...(rentals.get(payload.customerId) ?? []), payload.toolId]
    rentals.set(payload.customerId, toolIds)
    ctx.emitUpdate(
      GetCustomerRentals,
      payloadEquals({ customerId: payload.customerId }),
      toolIds,
    )
  },
)

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const customerRentals = eventProcessor("customer-rentals", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...rentTool, eventStore, commandBus, queryBus }],
  queryHandlers: [{ ...getCustomerRentals, queryBus }],
  eventHandlers: [{ ...recordRental, commandBus, queryBus, processor: customerRentals }],
})

const subscription = subscriptionQuery(queryBus, GetCustomerRentals, { customerId: "ada" })
console.log("initial:", await subscription.initialResult)

await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })

for await (const update of subscription.updates) {
  console.log("update:", update)
  break
}

subscription.close()
await app.stop()
