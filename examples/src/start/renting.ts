import { commandHandler, state } from "@kronos-ts/core"
import { z } from "zod"
import { CustomerRegistered, RentTool, ToolAdded, ToolRented } from "./messages"

type Rental = { toolId: string; customerId: string }

type RentingState = {
  toolAdded: boolean
  customerRegistered: boolean
  maxRentals: number
  rentals: Rental[]
}

export const Renting = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => ({ toolId: id.toolId, customerId: id.customerId }),
  evolve: [
    (): RentingState => ({ toolAdded: false, customerRegistered: false, maxRentals: 0, rentals: [] }),
    [ToolAdded, (renting) => ({ ...renting, toolAdded: true })],
    [
      CustomerRegistered,
      (renting, { payload }) => ({ ...renting, customerRegistered: true, maxRentals: payload.maxRentals }),
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
  const renting = await ctx.load(Renting, { toolId: payload.toolId, customerId: payload.customerId })

  const toolIsOut = renting.rentals.some((rental) => rental.toolId === payload.toolId)
  const customerRentals = renting.rentals.filter((rental) => rental.customerId === payload.customerId)

  if (!renting.toolAdded || toolIsOut) return { rented: false, reason: "tool-unavailable" }
  if (!renting.customerRegistered) return { rented: false, reason: "customer-unknown" }
  if (customerRentals.length >= renting.maxRentals) return { rented: false, reason: "over-limit" }

  ctx.append(ToolRented, payload)
  return { rented: true }
})
