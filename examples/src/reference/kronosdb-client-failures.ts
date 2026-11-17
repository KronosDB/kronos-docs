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
  KronosDbError,
  KronosDbRequestError,
  kronosDbCommandBus,
  kronosDbConnection,
} from "@kronos-ts/kronosdb"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

const kdb = await kronosDbConnection({ componentName: "toolstore-counter", serializer: jsonSerializer() })
const commandBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore")

export async function returnTool(toolId: string, customerId: string) {
  try {
    await send(commandBus, ReturnTool, { toolId, customerId })
    return "returned"
  } catch (error) {
    if (isConflict(error)) return "conflict"
    if (isNoHandler(error)) return "nobody-handles-it"
    if (isUnavailable(error)) return "try-again-later"
    if (error instanceof AuthenticationError) return "bad-token"
    if (error instanceof KronosDbRequestError) return `refused:${error.status}`
    if (error instanceof KronosDbError) return `kronosdb:${error.errorCode}`
    throw error
  }
}
