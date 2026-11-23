import { state } from "@kronos-ts/core"
import { z } from "zod"
import { CustomerRegistered, ToolAdded, ToolRented } from "../events"

type Customer = { registered: false } | { registered: true; maxRentals: number }

type Renting = {
  toolAdded: boolean
  customer: Customer
  rentals: { toolId: string; customerId: string }[]
}

/** The tool and the customer as renting needs them: whether each exists, and every rental of either. */
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
