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
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { AddTool, GetInventory, addTool, getInventory, recordAddedTool } from "./toolstore.js"
import { waitFor } from "./wait-for.js"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()

const eventStore = postgresEventStore(pg)
const tokenStore = postgresTokenStore(pg)
const uow = postgresUnitOfWork(unitOfWork, pg)

const commandBus = localCommandBus(uow)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, tokenStore, uow)

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
await pg.close()
