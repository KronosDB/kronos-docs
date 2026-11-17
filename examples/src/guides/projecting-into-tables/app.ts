import {
  eventProcessor,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
} from "@kronos-ts/core"
import {
  postgresEventStore,
  postgresHandler,
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { waitFor } from "./wait-for.js"
import {
  createInventoryTable,
  getInventory,
  recordAddedTool,
  recordRentedTool,
  recordReturnedTool,
} from "./inventory.js"
import { AddTool, GetInventory, RentTool, ReturnTool, addTool, rentTool, returnTool } from "./toolstore.js"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await pg.query(createInventoryTable)

const eventStore = postgresEventStore(pg)
const uow = postgresUnitOfWork(unitOfWork, pg)

const commandBus = localCommandBus(uow)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, postgresTokenStore(pg), uow)

const app = kronos({
  commandHandlers: [addTool, rentTool, returnTool].map((entry) => ({ ...entry, eventStore, commandBus, queryBus })),
  eventHandlers: [recordAddedTool, recordRentedTool, recordReturnedTool]
    .map((entry) => ({ ...entry, handler: postgresHandler(entry.handler, pg) }))
    .map((entry) => ({ ...entry, commandBus, queryBus, processor: inventoryView })),
  queryHandlers: [getInventory]
    .map((entry) => ({ ...entry, handler: postgresHandler(entry.handler, pg) }))
    .map((entry) => ({ ...entry, queryBus })),
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })

const tools = await waitFor(
  () => query(queryBus, GetInventory, {}),
  (rows) => rows.length === 2 && rows.some((row) => !row.available),
)
console.log(tools)

await app.stop()
await pg.close()
