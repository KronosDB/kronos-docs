import { commandHandler } from "@kronos-ts/core"
import { Renting, RentTool, ToolRented } from "./state.js"

// The conflict window is narrowed to rentals of this tool. A registration or a return
// that land after the load no longer make the append fail.
export const rentToolNarrowWindow = commandHandler(RentTool, {
  handler: async ({ payload }, ctx) => {
    const renting = await ctx.load(Renting, payload)
    if (!renting.customerRegistered) return { ok: false, rejection: "CUSTOMER_UNKNOWN", customerId: payload.customerId }
    if (!renting.toolAvailable) return { ok: false, rejection: "TOOL_UNAVAILABLE", toolId: payload.toolId }
    if (renting.rentals >= renting.maxRentals) {
      return { ok: false, rejection: "OVER_LIMIT", customerId: payload.customerId, maxRentals: renting.maxRentals }
    }
    ctx.append(ToolRented, payload)
    return { ok: true }
  },
  appendCondition: (command) => ({
    tags: { toolId: command.payload.toolId },
    types: [ToolRented],
  }),
})
