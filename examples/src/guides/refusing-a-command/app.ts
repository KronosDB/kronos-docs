import { inMemoryEventStore, kronos, localCommandBus, localQueryBus, unitOfWork } from "@kronos-ts/core"
import { recordingCommandBus, recordingEventStore } from "@kronos-ts/test"
import { registerCustomer } from "../../start/customer"
import { rentTool } from "../../start/renting"
import { addTool } from "../../start/tool"

export function toolStore() {
  const eventStore = recordingEventStore(inMemoryEventStore())
  const commandBus = recordingCommandBus(localCommandBus(unitOfWork))
  const queryBus = localQueryBus(unitOfWork)

  return kronos({
    commandHandlers: [
      { ...addTool, eventStore, commandBus, queryBus },
      { ...registerCustomer, eventStore, commandBus, queryBus },
      { ...rentTool, eventStore, commandBus, queryBus },
    ],
  })
}
