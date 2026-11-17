import {
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  queryHandler,
  unitOfWork,
} from "@kronos-ts/core"
import { recordingCommandBus, recordingEventStore } from "@kronos-ts/test"
import { registerCustomer } from "../../start/customer"
import { GetInventory, ToolAdded, ToolRented } from "../../start/messages"
import { rentTool } from "../../start/renting"
import { addTool } from "../../start/tool"

export function rentingSlice() {
  const eventStore = recordingEventStore(inMemoryEventStore())
  const commandBus = recordingCommandBus(localCommandBus(unitOfWork))
  const queryBus = localQueryBus(unitOfWork)
  const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

  const inventory = new Map<string, { toolId: string; name: string; available: boolean }>()
  const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
    inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, available: true })
  })
  const recordRentedTool = eventHandler(ToolRented, ({ payload }) => {
    const row = inventory.get(payload.toolId)
    if (row) inventory.set(payload.toolId, { ...row, available: false })
  })
  const getInventory = queryHandler(GetInventory, () => [...inventory.values()])

  return kronos({
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
}
