import {
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
} from "@kronos-ts/core"
import { ReturnTool, returnTool } from "./snapshots.js"

// A plain store: no snapshotting wrapper.
const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  commandHandlers: [{ ...returnTool, eventStore, commandBus, queryBus }],
})

try {
  await send(commandBus, ReturnTool, { toolId: "t-1", customerId: "ada" })
} catch (error) {
  console.log((error as Error).message)
}

await app.stop()
