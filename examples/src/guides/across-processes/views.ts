import {
  kronos,
  validatingHandler,
} from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { pipe } from "../../toolstore/pipe"
import { inventory } from "../../toolstore/slices/toolstore/inventory"
import { connect } from "./kronosdb-infrastructure"

const infrastructure = await connect("tool-views")
const { commandBus, queryBus, pg } = infrastructure

// This process runs the inventory slice.
const inventoryView = inventory(infrastructure.eventProcessor)

const app = kronos({
  queryHandlers: [...inventoryView.queryHandlers].map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    queryBus,
  })),
  eventHandlers: [...inventoryView.eventHandlers].map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    commandBus,
    queryBus,
  })),
})
await infrastructure.start()
console.log("views process ready")

process.on("SIGINT", async () => {
  await app.stop()
  await infrastructure.close()
  process.exit(0)
})
