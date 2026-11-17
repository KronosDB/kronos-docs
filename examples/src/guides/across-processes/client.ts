import { isNoHandler, query, send } from "@kronos-ts/core"
import { AddTool, GetInventory } from "./toolstore.js"
import { connect } from "./kronosdb-infrastructure.js"
import { waitFor } from "./wait-for.js"

const infrastructure = await connect("tool-client")
await infrastructure.start()

try {
  await send(infrastructure.commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
  await send(infrastructure.commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
} catch (error) {
  if (!isNoHandler(error)) throw error
  console.error("no process handles AddTool: is the commands process running?")
  process.exit(1)
}

const tools = await waitFor(
  () => query(infrastructure.queryBus, GetInventory, {}),
  (rows) => rows.length === 2,
)
console.log(tools)

await infrastructure.close()
