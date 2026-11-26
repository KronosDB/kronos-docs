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
import { caughtUp } from "./caught-up"
import { pipe } from "./pipe"
import { migrate } from "./migrations"
import { toolstore } from "./slices/toolstore"
import { AddTool } from "./slices/toolstore/add-tool/command"
import { GetInventory } from "./slices/toolstore/inventory/query"
import { RegisterCustomer } from "./slices/toolstore/register-customer/command"
import { RentTool } from "./slices/toolstore/rent-tool/command"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

const eventStore = postgresEventStore(pg)
const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
const queryBus = localQueryBus(unitOfWork)
// Each context's handlers, called once. A context is given Kronos's `eventProcessor` with this process's stores
// applied, and passes it to the slices that build a processor.
const toolstoreHandlers = toolstore((name) =>
  eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
)

// Each kind's list is the sum of the contexts' lists, every handler piped through the wrappers the whole app shares,
// innermost first, and given its infrastructure.
const app = kronos({
  commandHandlers: [...toolstoreHandlers.commandHandlers].map((handler) => ({
    ...handler,
    handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
    eventStore,
    commandBus,
    queryBus,
  })),
  queryHandlers: [...toolstoreHandlers.queryHandlers].map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    queryBus,
  })),
  eventHandlers: [...toolstoreHandlers.eventHandlers].map((handler) => ({
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
await send(commandBus, RegisterCustomer, { customerId: "grace", name: "Grace", maxRentals: 2 })

for (const [toolId, customerId] of [["t-1", "ada"], ["t-1", "grace"], ["t-2", "ada"], ["t-2", "linus"]] as const) {
  const outcome = await send(commandBus, RentTool, { toolId, customerId })
  console.log(`${customerId} rents ${toolId}: ${outcome.ok ? "rented" : outcome.rejection}`)
}

await caughtUp(app.processors.get("inventory-view")!, eventStore)
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await app.stop()
await pg.close()
