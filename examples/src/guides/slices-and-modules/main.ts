import {
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  send,
  unitOfWork,
} from "@kronos-ts/core"
import { AddTool } from "./add-tool"
import { catalogModule } from "./catalog"
import { GetInventory } from "./inventory"
import { RegisterCustomer } from "./register-customer"
import { RentTool } from "./rent-tool"
import { rentalsModule } from "./rentals"

const eventStore = inMemoryEventStore()
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const infrastructure = { eventStore, tokenStore: inMemoryTokenStore(), unitOfWork, commandBus, queryBus }

const modules = [catalogModule(infrastructure), rentalsModule(infrastructure)]

const app = kronos({
  commandHandlers: modules.flatMap((each) => each.commandHandlers),
  queryHandlers: modules.flatMap((each) => each.queryHandlers),
  eventHandlers: modules.flatMap((each) => each.eventHandlers),
})

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 2 })
console.log(JSON.stringify(await send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" })))

const inventoryView = app.processors.get("inventory-view")!
const head = await eventStore.getHeadPosition()
while (inventoryView.position < head) await new Promise((resolve) => setTimeout(resolve, 5))
console.log(JSON.stringify(await query(queryBus, GetInventory, {})))

await app.stop()
