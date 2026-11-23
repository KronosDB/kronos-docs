import { isNoHandler, query, send } from "@kronos-ts/core"
import { AddTool } from "../../toolstore/slices/toolstore/add-tool/command"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { connect } from "./kronosdb-infrastructure"
import { waitFor } from "./wait-for"

const infrastructure = await connect("tool-client")
await infrastructure.start()
const { commandBus, queryBus } = infrastructure

try {
  await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
  await send(commandBus, AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" })
} catch (error) {
  if (!isNoHandler(error)) throw error
  console.error("no process handles AddTool: is the commands process running?")
  process.exit(1)
}

const tools = await waitFor(
  () => query(queryBus, GetInventory, {}),
  (rows) => rows.length === 2,
)
for (const tool of tools) {
  console.log(`${tool.toolId}  ${tool.name.padEnd(14)}  ${tool.available ? "available" : "rented"}`)
}

await infrastructure.close()
