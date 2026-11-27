import { kronos, query, send, validatingHandler } from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { caughtUp } from "../../toolstore/caught-up"
import { pipe } from "../../toolstore/pipe"
import { addTool } from "../../toolstore/slices/toolstore/add-tool"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { registerCustomer } from "../../toolstore/slices/toolstore/register-customer"
import { RegisterCustomer } from "../../toolstore/slices/toolstore/register-customer/command"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"
import { close, commandBus, eventProcessor, eventStore, pg, queryBus } from "./config"
import { inventory } from "./inventory"

// A slice that builds a processor is called once, with the partially applied `eventProcessor` from `config.ts`.
const inventoryView = inventory(eventProcessor)

// Every handler piped through the wrappers the whole app shares, innermost first, and given its infrastructure.
const running = kronos({
  commandHandlers: [
    ...addTool().commandHandlers,
    ...registerCustomer().commandHandlers,
    ...rentTool().commandHandlers,
  ].map((handler) => ({
    ...handler,
    handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
    eventStore,
    commandBus,
    queryBus,
  })),
  queryHandlers: [...inventoryView.queryHandlers].map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    queryBus,
  })),
  eventHandlers: [...inventoryView.eventHandlers].map((handler) => ({
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

await caughtUp(running.processors.get("inventory-view")!, eventStore)
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await running.stop()
await close()
