import {
  commandHandler,
  emptyMetadata,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  state,
  tagsOf,
  unitOfWork,
  withNamespace,
  type EventDescriptor,
  type InferOutput,
  type StandardSchemaV1,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

// Messages
export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const RentalOverdue = ns.event("RentalOverdue", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const CustomerSuspended = ns.event("CustomerSuspended", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
  tags: { customerId: (payload) => payload.customerId },
})

export const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

// The state a decision loads
export const Suspension = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ suspended: false }),
    [CustomerSuspended, (suspension) => ({ ...suspension, suspended: true })],
  ],
})

export const suspendCustomer = commandHandler(SuspendCustomer, async ({ payload }, ctx) => {
  const suspension = await ctx.load(Suspension, { customerId: payload.customerId })
  if (suspension.suspended) return
  ctx.append(CustomerSuspended, payload)
})

// A read model and the handlers that keep it
const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
})

export const markRented = eventHandler(ToolRented, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) row.available = false
})

export const markReturned = eventHandler(ToolReturned, ({ payload }) => {
  const row = inventory.get(payload.toolId)
  if (row) row.available = true
})

// A handler that reacts by sending a command
export const suspendOnOverdue = eventHandler(RentalOverdue, async ({ payload }, ctx) => {
  if (ctx.isReplay()) return
  const suspension = await ctx.load(Suspension, { customerId: payload.customerId })
  if (suspension.suspended) return
  await ctx.send(SuspendCustomer, {
    customerId: payload.customerId,
    reason: `tool ${payload.toolId} is overdue`,
  })
})

// A second handler for an event that already has one
const addedPerModel = new Map<string, number>()

export const countAddedModels = eventHandler(ToolAdded, ({ payload }) => {
  addedPerModel.set(payload.model, (addedPerModel.get(payload.model) ?? 0) + 1)
})

// Assembly
const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)
const rentalDeadlines = eventProcessor("rental-deadlines", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...suspendCustomer, eventStore, commandBus, queryBus }],
  eventHandlers: [
    { ...recordAddedTool, commandBus, queryBus, processor: inventoryView },
    { ...countAddedModels, commandBus, queryBus, processor: inventoryView },
    { ...markRented, commandBus, queryBus, processor: inventoryView },
    { ...markReturned, commandBus, queryBus, processor: inventoryView },
    { ...suspendOnOverdue, commandBus, queryBus, processor: rentalDeadlines },
  ],
})

// Append events the way a command handler would have
async function record<P extends StandardSchemaV1>(descriptor: EventDescriptor<P>, payload: InferOutput<P>) {
  await eventStore.append([
    {
      kind: "event",
      identifier: crypto.randomUUID(),
      name: descriptor.name,
      version: descriptor.version,
      payload,
      metadata: emptyMetadata(),
      timestamp: Date.now(),
      tags: tagsOf(descriptor, payload, emptyMetadata()),
    },
  ])
}

await record(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await record(ToolAdded, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await record(ToolRented, { toolId: "t-1", customerId: "ada" })
await record(RentalOverdue, { toolId: "t-1", customerId: "ada" })

await new Promise((resolve) => setTimeout(resolve, 100))
await app.stop()

console.log([...inventory.values()])
console.log(app.processors.get("rental-deadlines")?.status())
const suspensions = await eventStore.source({ query: { types: [CustomerSuspended] } })
console.log(suspensions.events.map((event) => event.payload))
