import {
  commandHandler,
  describe,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  ctx.append(ToolAdded, payload)
})

type AnyHandler = (message: any, context: any) => any

// Supplies ctx.audit to the handler it wraps
function auditHandler<H extends AnyHandler>(next: H) {
  const wrapped = (message: Parameters<H>[0], context: Parameters<H>[1]) =>
    next(message, { ...context, audit: (line: string) => console.log(line) })
  return describe(wrapped, { name: "auditHandler", supplies: ["audit"], next })
}

// Needs ctx.audit from a wrapper outside it
function staffOnly<H extends AnyHandler>(next: H) {
  const wrapped = (message: Parameters<H>[0], context: Parameters<H>[1]) => {
    context.audit(`checking ${String(message.metadata.actor)}`)
    return next(message, context)
  }
  return describe(wrapped, {
    name: "staffOnly",
    uses: ["audit"],
    hints: { audit: "Wrap staffOnly in auditHandler, not the other way round." },
    next,
  })
}

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

// auditHandler is inside staffOnly, so nothing outside staffOnly supplies "audit"
try {
  kronos({
    commandHandlers: [
      { ...addTool, handler: staffOnly(auditHandler(addTool.handler)), eventStore, commandBus, queryBus },
    ],
  })
} catch (error) {
  console.log((error as Error).message)
}

// The other way round boots
const app = kronos({
  commandHandlers: [
    { ...addTool, handler: auditHandler(staffOnly(addTool.handler)), eventStore, commandBus, queryBus },
  ],
})
await app.stop()
