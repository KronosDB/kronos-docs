import { commandHandler } from "@kronos-ts/core"
import { ToolRented } from "../events"
import { RentTool } from "./command"
import { Renting } from "./state"

/** Renting a tool the customer already has is a retry: it succeeds and appends nothing. */
export const handle = commandHandler(RentTool, async ({ payload }, ctx) => {
  const { toolId, customerId } = payload
  const renting = await ctx.load(Renting, { toolId, customerId })

  const rentalsOfTool = renting.rentals.filter((rental) => rental.toolId === toolId)
  const rentalsOfCustomer = renting.rentals.filter((rental) => rental.customerId === customerId)

  if (rentalsOfTool.some((rental) => rental.customerId === customerId)) return { ok: true }
  if (!renting.toolAdded || rentalsOfTool.length > 0) return { ok: false, rejection: "TOOL_UNAVAILABLE", toolId }
  if (!renting.customer.registered) return { ok: false, rejection: "CUSTOMER_UNKNOWN", customerId }
  const { maxRentals } = renting.customer
  if (rentalsOfCustomer.length >= maxRentals) return { ok: false, rejection: "OVER_LIMIT", customerId, maxRentals }

  ctx.append(ToolRented, payload)
  return { ok: true }
})
