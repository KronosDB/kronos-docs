import {
  command,
  event,
  qn,
  query,
  withNamespace,
  type InferOutput,
  type InferResult,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

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

export const GetCustomerRentals = ns.query("GetCustomerRentals", {
  payload: z.object({ customerId: z.string() }),
  result: z.object({ toolIds: z.array(z.string()) }),
})

// The same declarations without a namespace helper
export const ReturnTool = command({
  name: qn("toolstore", "ReturnTool"),
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolReturned = event({
  name: qn("toolstore", "ToolReturned"),
  version: "2.0",
  payload: z.object({ toolId: z.string(), customerId: z.string(), returnedAt: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

export const GetToolStatus = query({
  name: qn("toolstore", "GetToolStatus"),
  payload: z.object({ toolId: z.string() }),
  result: z.object({ available: z.boolean() }),
})

// Types read off the descriptors
export type RentOutcome = InferResult<typeof RentTool.result>
export type ToolRentedPayload = InferOutput<typeof ToolRented.payload>

const outcome: RentOutcome = { ok: false, rejection: "OVER_LIMIT", customerId: "ada", maxRentals: 2 }
const rented: ToolRentedPayload = { toolId: "t-1", customerId: "ada" }

console.log(RentTool.name, RentTool.version, ToolReturned.version)
console.log(outcome, rented)
