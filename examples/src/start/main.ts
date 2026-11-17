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

console.log(JSON.stringify(await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })))
console.log(JSON.stringify(await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })))
console.log(JSON.stringify(await send(commandBus, RentTool, { toolId: "t-2", customerId: "ada" })))
console.log(JSON.stringify(await send(commandBus, RentTool, { toolId: "t-2", customerId: "linus" })))

await projectionsCaughtUp()
console.log(JSON.stringify(await query(queryBus, GetInventory, {}), null, 2))

await app.stop()
