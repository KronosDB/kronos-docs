import { commandHandler } from "@kronos-ts/core"
import { ServiceRequested } from "../../../toolstore/slices/toolstore/events"
import { RequestService } from "./command"
import { RENTALS_BETWEEN_SERVICES, Wear } from "./state"

/** Records the request. A tool whose service was requested since its last rentals is not requested again. */
export const handle = commandHandler(RequestService, async ({ payload }, ctx) => {
  const wear = await ctx.load(Wear, payload)
  if (wear.rentalsSinceService < RENTALS_BETWEEN_SERVICES) return { ok: true }
  ctx.append(ServiceRequested, payload)
  return { ok: true }
})
