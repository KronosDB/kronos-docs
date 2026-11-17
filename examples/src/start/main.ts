import { query, send } from "@kronos-ts/core"
import { app, commandBus, eventStore, queryBus } from "./app"
import { AddTool, GetInventory, RegisterCustomer, RentTool } from "./messages"

async function projectionsCaughtUp() {
  const head = await eventStore.getHeadPosition()
  const inventoryView = app.processors.get("inventory-view")!
  while (inventoryView.position < head) await new Promise((resolve) => setTimeout(resolve, 5))
}

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 1 })

for (const [toolId, customerId] of [["t-1", "ada"], ["t-1", "ada"], ["t-2", "ada"], ["t-2", "linus"]] as const) {
  const outcome = await send(commandBus, RentTool, { toolId, customerId })
  console.log(`${customerId} rents ${toolId}: ${outcome.rented ? "rented" : outcome.reason}`)
}

await projectionsCaughtUp()
for (const tool of await query(queryBus, GetInventory, {})) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await app.stop()
