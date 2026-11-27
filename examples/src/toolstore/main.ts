import { kronos, query, send, validatingHandler } from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { caughtUp } from "./caught-up"
import { close, commandBus, eventProcessor, eventStore, pg, queryBus } from "./config"
import { pipe } from "./pipe"
import { handlers } from "./slices"
import { AddTool } from "./slices/toolstore/add-tool/command"
import { GetInventory } from "./slices/toolstore/inventory/query"
import { RegisterCustomer } from "./slices/toolstore/register-customer/command"
import { RentTool } from "./slices/toolstore/rent-tool/command"

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
await close()
