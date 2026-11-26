import {
  AppendConditionError,
  commandHandler,
  inMemoryEventStore,
  isConflict,
  isNoHandler,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  state,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

// Messages
export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
})

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  result: z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), rejection: z.literal("TOOL_UNAVAILABLE"), toolId: z.string() }),
    z.object({ ok: z.literal(false), rejection: z.literal("CUSTOMER_UNKNOWN"), customerId: z.string() }),
    z.object({
      ok: z.literal(false),
      rejection: z.literal("OVER_LIMIT"),
      customerId: z.string(),
      maxRentals: z.number().int(),
    }),
  ]),
})

export const RentTools = ns.command("RentTools", {
  payload: z.object({ customerId: z.string(), toolIds: z.array(z.string()) }),
  result: z.object({ rented: z.array(z.string()), refused: z.array(z.string()) }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  tags: { customerId: (payload) => payload.customerId },
})

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

// States
export const Rental = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false, heldBy: undefined as string | undefined }),
    [ToolAdded, (rental) => ({ ...rental, exists: true })],
    [ToolRented, (rental, { payload }) => ({ ...rental, heldBy: payload.customerId })],
    [ToolReturned, (rental) => ({ ...rental, heldBy: undefined })],
  ],
})

export const Customer = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ registered: false, maxRentals: 0, rentals: 0 }),
    [CustomerRegistered, (customer, { payload }) => ({ ...customer, registered: true, maxRentals: payload.maxRentals })],
    [ToolRented, (customer) => ({ ...customer, rentals: customer.rentals + 1 })],
    [ToolReturned, (customer) => ({ ...customer, rentals: customer.rentals - 1 })],
  ],
})

// Handlers
export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const rental = await ctx.load(Rental, { toolId: payload.toolId })
  if (rental.exists) return
  ctx.append(ToolAdded, payload)
})

export const registerCustomer = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  ctx.append(CustomerRegistered, payload)
})

export const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const rental = await ctx.load(Rental, { toolId: payload.toolId })
  const customer = await ctx.load(Customer, { customerId: payload.customerId })

  if (!rental.exists || rental.heldBy !== undefined) return { ok: false, rejection: "TOOL_UNAVAILABLE", toolId: payload.toolId }
  if (!customer.registered) return { ok: false, rejection: "CUSTOMER_UNKNOWN", customerId: payload.customerId }
  if (customer.rentals >= customer.maxRentals) {
    return { ok: false, rejection: "OVER_LIMIT", customerId: payload.customerId, maxRentals: customer.maxRentals }
  }

  ctx.append(ToolRented, payload)
  return { ok: true }
})

// A handler that dispatches other commands
export const rentTools = commandHandler(RentTools, async ({ payload }, ctx) => {
  const rented: string[] = []
  const refused: string[] = []
  for (const toolId of payload.toolIds) {
    const outcome = await ctx.send(RentTool, { toolId, customerId: payload.customerId })
    if (outcome.ok) rented.push(toolId)
    else refused.push(toolId)
  }
  return { rented, refused }
})

// A handler that narrows its append condition
export const registerCustomerOnce = commandHandler(RegisterCustomer, {
  handler: async ({ payload }, ctx) => {
    const customer = await ctx.load(Customer, { customerId: payload.customerId })
    if (customer.registered) throw new Error(`customer ${payload.customerId} is already registered`)
    ctx.append(CustomerRegistered, payload)
  },
  appendCondition: (command) => ({ tags: { customerId: command.payload.customerId } }),
})

// A handler that reads the log directly
export const returnTool = commandHandler(
  ns.command("ReturnTool", { payload: z.object({ toolId: z.string(), customerId: z.string() }) }),
  async ({ payload }, ctx) => {
    const history = await ctx.source({ tags: { toolId: payload.toolId }, types: [ToolRented, ToolReturned] })
    const last = history.at(-1)
    if (last?.name.name !== "ToolRented") return
    ctx.append(ToolReturned, payload)
  },
)

// Assembly
const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [addTool, registerCustomer, rentTool, rentTools].map((handler) => ({
    ...handler,
    eventStore,
    commandBus,
    queryBus,
  })),
})

// Dispatch from outside a handler
await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 1 })

const outcome = await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })
console.log("outcome", JSON.stringify(outcome))

const refusal = await send(commandBus, RentTool, { toolId: "t-2", customerId: "ada" })
console.log("refusal", JSON.stringify(refusal))

// Two customers rent the same tool at once
await send(commandBus, RegisterCustomer, { customerId: "linus", name: "Linus", maxRentals: 2 })
await send(commandBus, RegisterCustomer, { customerId: "grace", name: "Grace", maxRentals: 2 })
const attempts = await Promise.allSettled([
  send(commandBus, RentTool, { toolId: "t-2", customerId: "linus" }),
  send(commandBus, RentTool, { toolId: "t-2", customerId: "grace" }),
])
for (const attempt of attempts) {
  if (attempt.status === "fulfilled") console.log("fulfilled", JSON.stringify(attempt.value))
  else if (isConflict(attempt.reason)) console.log("conflict", attempt.reason instanceof AppendConditionError)
  else throw attempt.reason
}

// A command nothing handles
try {
  await send(commandBus, ns.command("DiscardTool", { payload: z.object({ toolId: z.string() }) }), { toolId: "t-1" })
} catch (error) {
  console.log("no handler:", isNoHandler(error))
}

await app.stop()
