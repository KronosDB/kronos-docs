import {
  commandHandler,
  inMemoryEventStore,
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

export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

export const Customer = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ registered: false }),
    [CustomerRegistered, (customer) => ({ ...customer, registered: true })],
  ],
})

export const Renting = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => ({ toolId: id.toolId, customerId: id.customerId }),
  evolve: [
    (id) => ({
      toolId: id.toolId,
      customerId: id.customerId,
      toolAvailable: false,
      customerRegistered: false,
      rentals: 0,
      maxRentals: 0,
    }),
    [ToolAdded, (renting) => ({ ...renting, toolAvailable: true })],
    [
      CustomerRegistered,
      (renting, { payload }) => ({
        ...renting,
        customerRegistered: true,
        maxRentals: payload.maxRentals,
      }),
    ],
    [
      ToolRented,
      (renting, { payload }) => ({
        ...renting,
        toolAvailable: payload.toolId === renting.toolId ? false : renting.toolAvailable,
        rentals: payload.customerId === renting.customerId ? renting.rentals + 1 : renting.rentals,
      }),
    ],
    [
      ToolReturned,
      (renting, { payload }) => ({
        ...renting,
        toolAvailable: payload.toolId === renting.toolId ? true : renting.toolAvailable,
        rentals: payload.customerId === renting.customerId ? renting.rentals - 1 : renting.rentals,
      }),
    ],
  ],
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) return
  ctx.append(ToolAdded, payload)
})

export const registerCustomer = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  const customer = await ctx.load(Customer, { customerId: payload.customerId })
  if (customer.registered) return
  ctx.append(CustomerRegistered, payload)
})

export const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const renting = await ctx.load(Renting, payload)
  if (!renting.customerRegistered) return { ok: false, rejection: "CUSTOMER_UNKNOWN", customerId: payload.customerId }
  if (!renting.toolAvailable) return { ok: false, rejection: "TOOL_UNAVAILABLE", toolId: payload.toolId }
  if (renting.rentals >= renting.maxRentals) {
    return { ok: false, rejection: "OVER_LIMIT", customerId: payload.customerId, maxRentals: renting.maxRentals }
  }
  ctx.append(ToolRented, payload)
  return { ok: true }
})

export const eventStore = inMemoryEventStore()
export const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

export const app = kronos({
  commandHandlers: [
    { ...addTool, eventStore, commandBus, queryBus },
    { ...registerCustomer, eventStore, commandBus, queryBus },
    { ...rentTool, eventStore, commandBus, queryBus },
  ],
})

if (import.meta.main) {
  await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
  await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 2 })

  console.log(await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" }))
  console.log(await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" }))
  console.log(await send(commandBus, RentTool, { toolId: "t-9", customerId: "ada" }))

  await app.stop()
}
