import {
  deadLettering,
  eventProcessor,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  validatingHandler,
} from "@kronos-ts/core"
import { postgresDeadLetterQueue, postgresEventStore, postgresHandler, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { pipe } from "../../toolstore/pipe"
import { migrate } from "../../toolstore/migrations"
import { handlers } from "."

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

const eventStore = postgresEventStore(pg)
const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
const queryBus = localQueryBus(unitOfWork)
// The app's handlers, from the sum of its contexts. They are given Kronos's `eventProcessor` with this process's
// stores applied, and Kronos's `deadLettering` with its dead-letter queue applied, which reach the slices that use them.
const app = handlers(
  (name) => eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
  (processor, sequence) => deadLettering(processor, postgresDeadLetterQueue(pg), sequence),
)

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
