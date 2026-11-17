import { eventProcessor, inMemoryTokenStore, kronos, unitOfWork } from "@kronos-ts/core"
import { getInventory, recordAddedTool } from "./toolstore.js"
import { connect } from "./kronosdb-infrastructure.js"

const infrastructure = await connect("tool-views")
const { eventStore, commandBus, queryBus } = infrastructure

const inventoryView = eventProcessor("inventory-view", eventStore, inMemoryTokenStore(), unitOfWork)

const app = kronos({
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
  queryHandlers: [{ ...getInventory, queryBus }],
})
await infrastructure.start()
console.log("views process ready")

process.on("SIGINT", async () => {
  await app.stop()
  await infrastructure.close()
  process.exit(0)
})
