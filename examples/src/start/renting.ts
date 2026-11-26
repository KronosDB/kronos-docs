import { commandHandler, state } from "@kronos-ts/core"
import { z } from "zod"
import { CustomerRegistered, RentTool, ToolAdded, ToolRented } from "./messages"

type Customer = { registered: false } | { registered: true; maxRentals: number }

type Renting = {
  toolAdded: boolean
  customer: Customer
  rentals: { toolId: string; customerId: string }[]
}

export const Renting = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => ({ toolId: id.toolId, customerId: id.customerId }),
  evolve: [
    (): Renting => ({ toolAdded: false, customer: { registered: false }, rentals: [] }),
    [ToolAdded, (renting) => ({ ...renting, toolAdded: true })],
    [
      CustomerRegistered,
      (renting, { payload }) => ({ ...renting, customer: { registered: true, maxRentals: payload.maxRentals } }),
    ],
    [
      ToolRented,
      (renting, { payload }) => ({
        ...renting,
        rentals: [...renting.rentals, { toolId: payload.toolId, customerId: payload.customerId }],
      }),
    ],
  ],
})

export const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
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
