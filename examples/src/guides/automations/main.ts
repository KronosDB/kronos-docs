import { kronos, validatingHandler } from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { commandBus, deadLettering, eventProcessor, eventStore, pg, queryBus } from "../../toolstore/config"
import { pipe } from "../../toolstore/pipe"
import { handlers } from "."

// The final wiring: the app's handlers (slices/index.ts) wired to the infrastructure (config.ts).
const app = handlers(eventProcessor, deadLettering)

// Each kind's wrappers, innermost first.
const running = kronos({
  commandHandlers: app.commandHandlers.map((handler) => ({
    ...handler,
    handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
    eventStore,
    commandBus,
    queryBus,
  })),
  queryHandlers: app.queryHandlers.map((handler) => ({
    ...handler,
    handler: pipe(
      handler.handler,
      (next) => postgresHandler(next, pg),
      (next) => validatingHandler(next, handler.descriptor),
    ),
    queryBus,
  })),
  eventHandlers: app.eventHandlers.map((handler) => ({
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
