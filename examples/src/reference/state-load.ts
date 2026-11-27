import {
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  state,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  result: z.object({
    existedBefore: z.boolean(),
    existsAfterAppend: z.boolean(),
    otherStateSeesIt: z.boolean(),
  }),
})

const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

const ToolName = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ name: "" }),
    [ToolAdded, (tool, { payload }) => ({ ...tool, name: payload.name })],
  ],
})

const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const before = await ctx.load(Tool, { toolId: payload.toolId })
  ctx.append(ToolAdded, payload)
  // Same state and id: served from the unit of work, with the appended event folded in.
  const after = await ctx.load(Tool, { toolId: payload.toolId })
  // A state not loaded before the append reads the store, which has not seen the event yet.
  const name = await ctx.load(ToolName, { toolId: payload.toolId })
  return {
    existedBefore: before.exists,
    existsAfterAppend: after.exists,
    otherStateSeesIt: name.name !== "",
  }
})

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
})

console.log(await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }))

await app.stop()
