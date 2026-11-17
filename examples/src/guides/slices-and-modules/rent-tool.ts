import { commandHandler, state, withNamespace } from "@kronos-ts/core"
import { z } from "zod"
import { ToolAdded } from "./add-tool"
import { CustomerRegistered } from "./register-customer"
import { slice } from "./slice"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  result: z.discriminatedUnion("rented", [
    z.object({ rented: z.literal(true) }),
    z.object({
      rented: z.literal(false),
      reason: z.enum(["tool-unavailable", "customer-unknown", "over-limit"]),
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

type RentingState = {
  toolAdded: boolean
  customerRegistered: boolean
  maxRentals: number
  rentals: Array<{ toolId: string; customerId: string }>
}

const Renting = state({
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

const rentTool = commandHandler(RentTool, async ({ payload }, ctx) => {
  const renting = await ctx.load(Renting, { toolId: payload.toolId, customerId: payload.customerId })

  const toolIsOut = renting.rentals.some((rental) => rental.toolId === payload.toolId)
  const customerRentals = renting.rentals.filter((rental) => rental.customerId === payload.customerId)

  if (!renting.toolAdded || toolIsOut) return { rented: false, reason: "tool-unavailable" }
  if (!renting.customerRegistered) return { rented: false, reason: "customer-unknown" }
  if (customerRentals.length >= renting.maxRentals) return { rented: false, reason: "over-limit" }

  ctx.append(ToolRented, payload)
  return { rented: true }
})

export const rentToolSlice = slice({ commandHandlers: [rentTool] })
