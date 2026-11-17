import {
  isConflict,
  isNoHandler,
  isUnavailable,
  jsonSerializer,
  localCommandBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import {
  AuthenticationError,
  AxonServerError,
  axonServerCommandBus,
  axonServerConnection,
} from "@kronos-ts/axon-server"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

const axon = await axonServerConnection({ componentName: "toolstore-counter", serializer: jsonSerializer() })
const commandBus = axonServerCommandBus(localCommandBus(unitOfWork), axon)

export async function returnTool(toolId: string, customerId: string) {
  try {
    await send(commandBus, ReturnTool, { toolId, customerId })
    return "returned"
  } catch (error) {
    if (isConflict(error)) return "conflict"
    if (isNoHandler(error)) return "nobody-handles-it"
    if (isUnavailable(error)) return "try-again-later"
    if (error instanceof AuthenticationError) return "bad-token"
    if (error instanceof AxonServerError) return `axon:${error.errorCode}`
    throw error
  }
}
