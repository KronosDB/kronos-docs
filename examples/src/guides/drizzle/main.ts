import {
  eventProcessor,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
  validatingHandler,
} from "@kronos-ts/core"
import { postgresEventStore, postgresHandler, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { caughtUp } from "../../toolstore/caught-up"
import { pipe } from "../../toolstore/pipe"
import { addTool } from "../../toolstore/slices/toolstore/add-tool"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { registerCustomer } from "../../toolstore/slices/toolstore/register-customer"
import { RegisterCustomer } from "../../toolstore/slices/toolstore/register-customer/command"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"
import { inventory } from "./inventory"

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore"

// The migrations drizzle-kit generated from the slices' schemas, applied before the app starts.
const migrator = drizzle(databaseUrl)
await migrate(migrator, { migrationsFolder: new URL("./migrations", import.meta.url).pathname })
await migrator.$client.end()

const pg = postgresPool(databaseUrl)
await pg.start()

const eventStore = postgresEventStore(pg)
const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
const queryBus = localQueryBus(unitOfWork)
// Every slice's handlers, its processors built over this process's stores.
const handlers = [
  addTool(),
  registerCustomer(),
  rentTool(),
  inventory((name) => eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))),
]

// Every handler piped through the wrappers the whole app shares, innermost first, and given its infrastructure.
const app = kronos({
  commandHandlers: handlers
    .map((slice) => slice.commandHandlers)
    .flat()
    .map((handler) => ({
      ...handler,
      handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
      eventStore,
      commandBus,
      queryBus,
    })),
  queryHandlers: handlers
    .map((slice) => slice.queryHandlers)
    .flat()
    .map((handler) => ({
      ...handler,
      handler: pipe(
        handler.handler,
        (next) => postgresHandler(next, pg),
        (next) => validatingHandler(next, handler.descriptor),
      ),
      queryBus,
    })),
  eventHandlers: handlers
    .map((slice) => slice.eventHandlers)
    .flat()
    .map((handler) => ({
      ...handler,
      handler: pipe(
        handler.handler,
        (next) => postgresHandler(next, pg),
        (next) => validatingHandler(next, handler.descriptor),
      ),
      commandBus,
      queryBus,
    })),
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 1 })
await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })

await caughtUp(app.processors.get("inventory-view")!, eventStore)
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await app.stop()
await pg.close()
