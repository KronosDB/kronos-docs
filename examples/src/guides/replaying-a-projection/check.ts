/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { kronos, query, send, validatingHandler } from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { caughtUp } from "../../toolstore/caught-up"
import { close, commandBus, eventProcessor, eventStore, pg, queryBus } from "../../toolstore/config"
import { pipe } from "../../toolstore/pipe"
import { handlers } from "../../toolstore/slices"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { RegisterCustomer } from "../../toolstore/slices/toolstore/register-customer/command"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"
import { serveAdmin } from "./server"

// The final wiring: the app's handlers (slices/index.ts) wired to the infrastructure (config.ts).
const app = handlers(eventProcessor)

// Each kind's wrappers, innermost first.
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

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 1 })
await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })

const inventoryView = running.processors.get("inventory-view")!
const summary = async () =>
  (await query(queryBus, GetInventory, {})).map((row) => `${row.toolId} ${row.available ? "available" : "rented"}`).join(", ")

await caughtUp(inventoryView, eventStore)
console.log("before replay:", await summary())

const server = serveAdmin(running.processors)
const started = await fetch(new URL("/admin/processors/inventory-view/replay", server.url), { method: "POST" })
console.log("POST replay", started.status, JSON.stringify(await started.json()))

while (inventoryView.replaying) await Bun.sleep(10)
const status = await fetch(new URL("/admin/processors/inventory-view", server.url))
console.log("GET status", JSON.stringify(await status.json()))
console.log("after replay:", await summary())

await server.stop()
await running.stop()
await close()
