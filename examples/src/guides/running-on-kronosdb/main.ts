import {
  eventProcessor,
  jsonSerializer,
  kronos,
  localCommandBus,
  localFirstQueryBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
  validatingHandler,
} from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection, kronosDbEventStore, kronosDbQueryBus } from "@kronos-ts/kronosdb"
import { postgresHandler, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { caughtUp } from "../../toolstore/caught-up"
import { pipe } from "../../toolstore/pipe"
import { migrate } from "../../toolstore/migrations"
import { handlers } from "../../toolstore/slices"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { RegisterCustomer } from "../../toolstore/slices/toolstore/register-customer/command"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"

// Postgres: the read models, the processors' positions and the dead letters.
const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

// KronosDB: the event log and both buses, over one connection.
const kdb = await kronosDbConnection({
  host: process.env.KRONOSDB_HOST ?? "localhost",
  port: Number(process.env.KRONOSDB_PORT ?? 50051),
  context: "toolstore",
  componentName: "toolstore",
  serializer: jsonSerializer(),
})

const eventStore = kronosDbEventStore(kdb, "toolstore")
const commandBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore")
const localQueries = localQueryBus(unitOfWork)
const queryBus = localFirstQueryBus(kronosDbQueryBus(localQueries, kdb, "toolstore"), localQueries)

// The app's handlers, from `slices/index.ts`. They are given Kronos's `eventProcessor` with this process's stores
// applied, which reaches every slice that builds a processor.
const app = handlers((name) =>
  eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
)

// Every handler of each kind piped through the wrappers the whole app shares, innermost first, and given its
// infrastructure.
const running = kronos({
  commandHandlers: app.commandHandlers.map((handler) => ({
    ...handler,
    handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
    eventStore,
    commandBus,
    queryBus,
  })),
  queryHandlers: app.queryHandlers.map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    queryBus,
  })),
  eventHandlers: app.eventHandlers.map((handler) => ({
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
await kdb.start()

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 1 })
await send(commandBus, RegisterCustomer, { customerId: "grace", name: "Grace", maxRentals: 2 })

for (const [toolId, customerId] of [["t-1", "ada"], ["t-1", "grace"], ["t-2", "ada"], ["t-2", "linus"]] as const) {
  const outcome = await send(commandBus, RentTool, { toolId, customerId })
  console.log(`${customerId} rents ${toolId}: ${outcome.ok ? "rented" : outcome.rejection}`)
}

await caughtUp(running.processors.get("inventory-view")!, eventStore)
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await running.stop()
await kdb.close()
await pg.close()
