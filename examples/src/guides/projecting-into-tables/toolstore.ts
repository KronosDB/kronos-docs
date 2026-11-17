import { commandHandler, state, withNamespace } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  result: z.discriminatedUnion("rented", [
    z.object({ rented: z.literal(true) }),
    z.object({ rented: z.literal(false), reason: z.enum(["tool-unavailable", "customer-unknown", "over-limit"]) }),
  ]),
})

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

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

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

export const Rental = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ heldBy: null as string | null }),
    [ToolRented, (rental, { payload }) => ({ ...rental, heldBy: payload.customerId })],
    [ToolReturned, (rental) => ({ ...rental, heldBy: null })],
  ],
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) throw new Error(`tool ${payload.toolId} already exists`)
  ctx.append(ToolAdded, payload)
})

export const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const rental = await ctx.load(Rental, { toolId: payload.toolId })
  if (rental.heldBy !== null) return { rented: false, reason: "tool-unavailable" }
  ctx.append(ToolRented, payload)
  return { rented: true }
})

export const returnTool = commandHandler(ReturnTool, async ({ payload }, ctx) => {
  const rental = await ctx.load(Rental, { toolId: payload.toolId })
  if (rental.heldBy !== payload.customerId) throw new Error(`tool ${payload.toolId} is not rented by ${payload.customerId}`)
  ctx.append(ToolReturned, payload)
})
