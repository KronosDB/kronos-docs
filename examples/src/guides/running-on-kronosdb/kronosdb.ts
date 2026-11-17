import {
  eventProcessor,
  inMemoryTokenStore,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
} from "@kronos-ts/core"
import {
  kronosDbCommandBus,
  kronosDbConnection,
  kronosDbEventStore,
  kronosDbQueryBus,
} from "@kronos-ts/kronosdb"
import { AddTool, GetInventory, addTool, getInventory, recordAddedTool } from "./toolstore.js"
import { waitFor } from "./wait-for.js"

const kdb = await kronosDbConnection({
  host: process.env.KRONOSDB_HOST ?? "localhost",
  port: Number(process.env.KRONOSDB_PORT ?? 50051),
  context: "toolstore",
  componentName: "toolstore",
  serializer: jsonSerializer(),
})

const eventStore = kronosDbEventStore(kdb, "toolstore")
const commandBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore")
const queryBus = kronosDbQueryBus(localQueryBus(unitOfWork), kdb, "toolstore")
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
  queryHandlers: [{ ...getInventory, queryBus }],
})
await kdb.start()

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })

const tools = await waitFor(() => query(queryBus, GetInventory, {}), (rows) => rows.length === 2)
for (const tool of tools) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await app.stop()
await kdb.close()
