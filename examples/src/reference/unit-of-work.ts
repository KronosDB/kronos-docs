import {
  WrongUoWPhase,
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

// One unit of work, driven by hand
const manual = unitOfWork()
manual.onPrepareCommit(() => console.log("prepare-commit"))
manual.onCommit(() => console.log("commit"))
manual.onAfterCommit(() => console.log("after-commit"))
manual.whenComplete(() => console.log("complete"))

const answer = await manual.execute(async (uow) => {
  console.log(`running in ${uow.phase}`)
  return 42
})
console.log(answer, manual.closed)

// Hooks from a handler
const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

export const returnTool = commandHandler(ReturnTool, async ({ payload }, ctx) => {
  ctx.append(ToolReturned, payload)
  ctx.unitOfWork.onPrepareCommit(() => {
    console.log(`flushing ${ctx.unitOfWork.events.buffered.length} event(s)`)
  })
  ctx.unitOfWork.onAfterCommit(() => {
    console.log(`stored the return of ${payload.toolId}`)
  })
  ctx.unitOfWork.onError((error, phase) => {
    console.log(`return of ${payload.toolId} failed in ${phase}: ${String(error)}`)
  })
})

const app = kronos({
  commandHandlers: [{ ...returnTool, eventStore, commandBus, queryBus }],
})

await send(commandBus, ReturnTool, { toolId: "t-1", customerId: "ada" })

// Appending from a lifecycle hook
export const returnToolLate = commandHandler(ReturnTool, async ({ payload }, ctx) => {
  ctx.unitOfWork.onPrepareCommit(() => {
    ctx.append(ToolReturned, payload)
  })
})

const lateBus = localCommandBus(unitOfWork)
const lateApp = kronos({
  commandHandlers: [{ ...returnToolLate, eventStore, commandBus: lateBus, queryBus }],
})

try {
  await send(lateBus, ReturnTool, { toolId: "t-2", customerId: "ada" })
} catch (error) {
  console.log(error instanceof WrongUoWPhase, (error as WrongUoWPhase).currentPhase)
}

await app.stop()
await lateApp.stop()
