import { kronos } from "@kronos-ts/core"
import { addTool } from "./toolstore.js"
import { connect } from "./kronosdb-infrastructure.js"

const infrastructure = await connect("tool-commands")

const app = kronos({
  commandHandlers: [
    { ...addTool, eventStore: infrastructure.eventStore, commandBus: infrastructure.commandBus, queryBus: infrastructure.queryBus },
  ],
})
await infrastructure.start()
console.log("commands process ready")

process.on("SIGINT", async () => {
  await app.stop()
  await infrastructure.close()
  process.exit(0)
})
