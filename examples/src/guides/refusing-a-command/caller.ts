import { type CommandBus, isConflict, isUnavailable, send } from "@kronos-ts/core"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"

export type Reply = { status: number; body: { message: string } }

export async function rentEndpoint(commandBus: CommandBus, toolId: string, customerId: string): Promise<Reply> {
  try {
    const outcome = await send(commandBus, RentTool, { toolId, customerId })
    if (outcome.ok) return { status: 200, body: { message: `${customerId} rented ${toolId}` } }

    switch (outcome.rejection) {
      case "TOOL_UNAVAILABLE":
        return { status: 409, body: { message: `${outcome.toolId} is not on the shelf` } }
      case "CUSTOMER_UNKNOWN":
        return { status: 404, body: { message: `${outcome.customerId} is not registered` } }
      case "OVER_LIMIT":
        return { status: 409, body: { message: `${outcome.customerId} is at their rental limit (${outcome.maxRentals})` } }
    }
  } catch (failure) {
    if (isConflict(failure)) return { status: 409, body: { message: "the tool or the customer changed, send it again" } }
    if (isUnavailable(failure)) return { status: 503, body: { message: "try again shortly" } }
    throw failure
  }
}
