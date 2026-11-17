import {
  commandHandler,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
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

export const recordTool = eventHandler(ToolAdded, () => {})
export const countTools = eventHandler(ToolAdded, () => {})

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

function boot(label: string, start: () => unknown) {
  try {
    start()
  } catch (error) {
    console.log(`${label}\n${(error as Error).message}\n`)
  }
}

// A command handler without an event store
boot("missing store", () =>
  kronos({
    commandHandlers: [{ ...addTool, commandBus, queryBus }],
  }),
)

// Two processors with the same name and different settings
const tokenStore = inMemoryTokenStore()
boot("conflicting processors", () =>
  kronos({
    eventHandlers: [
      {
        ...recordTool,
        name: "record-tool",
        commandBus,
        queryBus,
        processor: eventProcessor("inventory-view", eventStore, tokenStore, unitOfWork),
      },
      {
        ...countTools,
        name: "count-tools",
        commandBus,
        queryBus,
        processor: eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork),
      },
    ],
  }),
)
