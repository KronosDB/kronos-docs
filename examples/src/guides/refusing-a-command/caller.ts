import { isConflict, isUnavailable, send, type CommandBus } from "@kronos-ts/core"
import { RentTool } from "../../start/messages"

export type Reply = { status: number; body: { message: string } }

export async function rentEndpoint(commandBus: CommandBus, toolId: string, customerId: string): Promise<Reply> {
  try {
    const outcome = await send(commandBus, RentTool, { toolId, customerId })
    if (outcome.rented) return { status: 200, body: { message: `${customerId} rented ${toolId}` } }

    switch (outcome.reason) {
      case "tool-unavailable":
        return { status: 409, body: { message: `${toolId} is not on the shelf` } }
      case "customer-unknown":
        return { status: 404, body: { message: `${customerId} is not registered` } }
      case "over-limit":
        return { status: 422, body: { message: `${customerId} is at their rental limit` } }
    }
  } catch (failure) {
    if (isConflict(failure)) return { status: 409, body: { message: "someone else changed this, try again" } }
    if (isUnavailable(failure)) return { status: 503, body: { message: "try again shortly" } }
    throw failure
  }
}
