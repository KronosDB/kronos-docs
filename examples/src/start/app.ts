import {
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { addTool } from "./tool"
import { registerCustomer } from "./customer"
import { rentTool } from "./renting"
import { getInventory, recordAddedTool, recordRentedTool } from "./inventory"

export const eventStore = inMemoryEventStore()
export const commandBus = localCommandBus(unitOfWork)
export const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

export const app = kronos({
  commandHandlers: [
    { ...addTool, eventStore, commandBus, queryBus },
    { ...registerCustomer, eventStore, commandBus, queryBus },
    { ...rentTool, eventStore, commandBus, queryBus },
  ],
  eventHandlers: [
    { ...recordAddedTool, commandBus, queryBus, processor: inventoryView },
    { ...recordRentedTool, commandBus, queryBus, processor: inventoryView },
  ],
  queryHandlers: [{ ...getInventory, queryBus }],
})
