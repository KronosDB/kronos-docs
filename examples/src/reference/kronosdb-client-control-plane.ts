import {
  eventHandler,
  eventProcessor,
  inMemoryTokenStore,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { kronosDbConnection, kronosDbControlPlane, kronosDbEventStore } from "@kronos-ts/kronosdb"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  console.log("added", payload.toolId)
})

const kdb = await kronosDbConnection({
  componentName: "toolstore-inventory",
  serializer: jsonSerializer(),
  context: "toolstore",
  platformService: {
    processorsNotificationInitialDelayMs: 2_000,
    processorsNotificationRateMs: 1_000,
  },
})

const eventStore = kronosDbEventStore(kdb, "toolstore")
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...recordAddedTool, eventStore, commandBus, queryBus, processor: inventoryView }],
})

const control = kronosDbControlPlane(kdb, app.processors)
await kdb.start()

await app.stop()
await control.close()
await kdb.close()
