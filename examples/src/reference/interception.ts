import {
  type Message,
  commandHandler,
  inMemoryEventStore,
  interceptingCommandBus,
  interceptingQueryBus,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  queryHandler,
  send,
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

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.string()),
})

// An intercept takes a message and returns a message of the same type, or throws to refuse it
const requireActor = <M extends Message>(message: M): M => {
  if (typeof message.metadata.actor !== "string") {
    throw new Error(`${message.name.name} was sent without an actor`)
  }
  return message
}

const addSource = <M extends Message>(message: M): M => ({
  ...message,
  metadata: { ...message.metadata, source: "counter" },
})

// Several intercepts compose as one function, written in the order they run
const atTheCounter = <M extends Message>(message: M): M => addSource(requireActor(message))

const eventStore = inMemoryEventStore()
const commandBus = interceptingCommandBus(localCommandBus(unitOfWork), atTheCounter)
const queryBus = interceptingQueryBus(localQueryBus(unitOfWork), addSource)

export const addTool = commandHandler(AddTool, async ({ payload, metadata }, ctx) => {
  console.log(`handling ${payload.toolId} from ${String(metadata.source)}`)
  ctx.append(ToolAdded, payload)
})

export const getInventory = queryHandler(GetInventory, ({ metadata }) => [String(metadata.source)])

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
  queryHandlers: [{ ...getInventory, queryBus }],
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }, { actor: "staff-4" })
console.log("sources", JSON.stringify(await query(queryBus, GetInventory, {})))

try {
  await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
} catch (error) {
  console.log((error as Error).message)
}

await app.stop()
