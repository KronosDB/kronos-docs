import {
  kronos,
  validatingHandler,
} from "@kronos-ts/core"
import { pipe } from "../../toolstore/pipe"
import { addTool } from "../../toolstore/slices/toolstore/add-tool"
import { registerCustomer } from "../../toolstore/slices/toolstore/register-customer"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { connect } from "./kronosdb-infrastructure"

const infrastructure = await connect("tool-commands")
const { eventStore, commandBus, queryBus } = infrastructure

// This process runs the command slices: its list is the sum of theirs.
const app = kronos({
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
})
await infrastructure.start()
console.log("commands process ready")

process.on("SIGINT", async () => {
  await app.stop()
  await infrastructure.close()
  process.exit(0)
})
