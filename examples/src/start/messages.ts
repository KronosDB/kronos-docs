import { withNamespace } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  result: z.object({ ok: z.literal(true) }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  result: z.object({ ok: z.literal(true) }),
})

export const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  tags: { customerId: (payload) => payload.customerId },
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

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})
