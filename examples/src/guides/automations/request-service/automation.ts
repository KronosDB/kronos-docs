import { eventHandler } from "@kronos-ts/core"
import { ToolRented } from "../../../toolstore/slices/toolstore/events"
import { RequestService } from "./command"
import { RENTALS_BETWEEN_SERVICES, Wear } from "./state"

/** After a tool's tenth rental since its last service, request a service for it. */
export const automation = [
  eventHandler(ToolRented, async ({ payload }, ctx) => {
    const wear = await ctx.load(Wear, { toolId: payload.toolId })
    if (wear.rentalsSinceService < RENTALS_BETWEEN_SERVICES) return
    await ctx.send(RequestService, { toolId: payload.toolId })
  }),
]
