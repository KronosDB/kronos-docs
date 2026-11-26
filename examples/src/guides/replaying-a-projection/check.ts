/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
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
import { caughtUp } from "../../toolstore/caught-up"
import { pipe } from "../../toolstore/pipe"
import { migrate } from "../../toolstore/migrations"
import { toolstore } from "../../toolstore/slices/toolstore"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { RegisterCustomer } from "../../toolstore/slices/toolstore/register-customer/command"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"
import { serveAdmin } from "./server"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

const eventStore = postgresEventStore(pg)
const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
const queryBus = localQueryBus(unitOfWork)
// Every slice's handlers. Each context is given Kronos's `eventProcessor` with this process's stores applied, and
// passes it to the slices that build a processor.
const handlers = [
  ...toolstore((name) => eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))),
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

const inventoryView = app.processors.get("inventory-view")!
const summary = async () =>
  (await query(queryBus, GetInventory, {})).map((row) => `${row.toolId} ${row.available ? "available" : "rented"}`).join(", ")

await caughtUp(inventoryView, eventStore)
console.log("before replay:", await summary())

const server = serveAdmin(app.processors)
const started = await fetch(new URL("/admin/processors/inventory-view/replay", server.url), { method: "POST" })
console.log("POST replay", started.status, JSON.stringify(await started.json()))

while (inventoryView.replaying) await Bun.sleep(10)
const status = await fetch(new URL("/admin/processors/inventory-view", server.url))
console.log("GET status", JSON.stringify(await status.json()))
console.log("after replay:", await summary())

await server.stop()
await app.stop()
await pg.close()
