import {
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
} from "@kronos-ts/core"
import { AddTool, GetInventory, addTool, getInventory, recordAddedTool } from "./toolstore.js"
import { waitFor } from "./wait-for.js"

const eventStore = inMemoryEventStore()
const tokenStore = inMemoryTokenStore()

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, tokenStore, unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
  queryHandlers: [{ ...getInventory, queryBus }],
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })

const tools = await waitFor(() => query(queryBus, GetInventory, {}), (rows) => rows.length === 2)
console.log(tools)
await app.stop()
