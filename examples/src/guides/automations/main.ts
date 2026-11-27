import { kronos, validatingHandler } from "@kronos-ts/core"
import { postgresHandler } from "@kronos-ts/postgres"
import { commandBus, deadLettering, eventProcessor, eventStore, pg, queryBus } from "../../toolstore/config"
import { pipe } from "../../toolstore/pipe"
import { handlers } from "."

// The app's handlers, given the partially applied functions from `config.ts`.
const app = handlers(eventProcessor, deadLettering)

// Every handler of each kind piped through the wrappers the whole app shares, innermost first, and given its
// infrastructure.
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
