import { commandHandler } from "@kronos-ts/core"
import { Renting, RentTool, ToolRented } from "./state.js"

// The conflict window is narrowed to rentals of this tool. A registration or a return
// that land after the load no longer make the append fail.
export const rentToolNarrowWindow = commandHandler(RentTool, {
  handler: async ({ payload }, ctx) => {
    const renting = await ctx.load(Renting, payload)
    if (!renting.customerRegistered) return { rented: false, reason: "customer-unknown" }
    if (!renting.toolAvailable) return { rented: false, reason: "tool-unavailable" }
    if (renting.rentals >= renting.maxRentals) return { rented: false, reason: "over-limit" }
    ctx.append(ToolRented, payload)
    return { rented: true }
  },
  appendCondition: (command) => ({
    tags: { toolId: command.payload.toolId },
    types: [ToolRented],
  }),
})
