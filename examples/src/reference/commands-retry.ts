import {
  isConflict,
  isUnavailable,
  localCommandBus,
  send,
  unitOfWork,
  withNamespace,
  type CommandBus,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

// Dispatch again when the command lost a race. The handler loads and decides again on each attempt.
export async function sendReturn(commandBus: CommandBus, toolId: string, customerId: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await send(commandBus, ReturnTool, { toolId, customerId })
    } catch (error) {
      if (isConflict(error) && attempt < 3) continue
      if (isUnavailable(error)) throw new Error(`the command may or may not have been applied: ${error.message}`)
      throw error
    }
  }
}

const commandBus = localCommandBus(unitOfWork)
commandBus.subscribe("toolstore.ReturnTool", async () => undefined)
await sendReturn(commandBus, "t-1", "ada")
