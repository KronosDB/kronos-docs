import {
  commandHandler,
  consoleLogger,
  correlatingHandler,
  correlation,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  interceptingCommandBus,
  interceptingQueryBus,
  kronos,
  localCommandBus,
  localQueryBus,
  loggingHandler,
  messageOrigin,
  send,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type EventHandlerContext,
  type LogCapability,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const CustomerSuspended = ns.event("CustomerSuspended", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
  tags: { customerId: (payload) => payload.customerId },
})

export const rentTool = commandHandler(
  RentTool,
  async ({ payload }, ctx: CommandHandlerContext & LogCapability) => {
    ctx.log.info("renting a tool", { toolId: payload.toolId, customerId: payload.customerId })
    ctx.append(ToolRented, payload)
  },
)

export const suspendCustomer = commandHandler(SuspendCustomer, ({ payload }, ctx) => {
  ctx.append(CustomerSuspended, payload)
})

export const suspendOnRental = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & LogCapability) => {
    ctx.log.warn("suspending the customer after a rental, for the sake of the example")
    await ctx.send(SuspendCustomer, { customerId: payload.customerId, reason: "demo" })
  },
)

export const logSuspension = eventHandler(CustomerSuspended, ({ metadata }) => {
  console.log("CustomerSuspended metadata:", metadata)
})

// The edge seeds correlationId and causationId on every message that enters a bus.
const commandBus = interceptingCommandBus(localCommandBus(unitOfWork), correlation)
const queryBus = interceptingQueryBus(localQueryBus(unitOfWork), correlation)

const eventStore = inMemoryEventStore()
const processor = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)
const logger = consoleLogger({ level: "info" })

// The standard cargo, plus a fact of this host.
const carry = correlatingHandler

const app = kronos({
  commandHandlers: [
    { ...rentTool, handler: loggingHandler(carry(rentTool.handler), logger) },
    { ...suspendCustomer, handler: carry(suspendCustomer.handler) },
  ].map((entry) => ({ ...entry, eventStore, commandBus, queryBus })),
  eventHandlers: [
    { ...suspendOnRental, handler: loggingHandler(carry(suspendOnRental.handler), logger) },
    { ...logSuspension },
  ].map((entry) => ({ ...entry, commandBus, queryBus, processor })),
})

await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })
await new Promise((resolve) => setTimeout(resolve, 200))
await app.stop()

// Extra cargo, computed from the message being handled.
export const withActor = correlatingHandler(rentTool.handler, (message) => ({
  ...messageOrigin(message),
  actor: String(message.metadata.actor ?? ""),
}))
