import {
  commandHandler,
  eventHandler,
  eventProcessor,
  inMemoryTokenStore,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import {
  axonServerCommandBus,
  axonServerConnection,
  axonServerControlPlane,
  axonServerEventStore,
  axonServerQueryBus,
  axonServerSnapshottingEventStore,
  type ManagedEventProcessor,
} from "@kronos-ts/axon-server"
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

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  console.log("added", payload.toolId)
})

export async function run(token: string) {
  const axon = await axonServerConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    host: "axonserver.internal",
    port: 8124,
    context: "toolstore",
    token,
  })

  const eventStore = axonServerSnapshottingEventStore(
    axonServerEventStore(axon, "toolstore"),
    axon,
    "toolstore",
  )
  const commandBus = axonServerCommandBus(localCommandBus(unitOfWork), axon, { context: "toolstore" })
  const queryBus = axonServerQueryBus(localQueryBus(unitOfWork), axon, { context: "toolstore" })
  const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

  const app = kronos({
    commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
    eventHandlers: [{ ...recordAddedTool, eventStore, commandBus, queryBus, processor: inventoryView }],
  })

  await axon.start()
  const control = await axonServerControlPlane(axon, app.processors.values() as Iterable<ManagedEventProcessor>)

  await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })

  await app.stop()
  await control.close()
  await axon.close()
}
