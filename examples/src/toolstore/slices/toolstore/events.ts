import { withNamespace } from "@kronos-ts/core"
import { z } from "zod"

/** The tool store's namespace and every event in it. Slices share these, and nothing else. */
export const ns = withNamespace("toolstore")

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number().int() }),
  tags: { customerId: (payload) => payload.customerId },
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

export const ReceiptSent = ns.event("ReceiptSent", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})
