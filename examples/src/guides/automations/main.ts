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
import { toolstore } from "./toolstore"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

const eventStore = postgresEventStore(pg)
const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
const queryBus = localQueryBus(unitOfWork)
// Every slice's handlers. Each context is given Kronos's `eventProcessor` with this process's stores applied, and
// Kronos's `deadLettering` with its dead-letter queue applied, and passes them to the slices that use them.
const handlers = [
  ...toolstore(
    (name) => eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
    (processor, sequence) => deadLettering(processor, postgresDeadLetterQueue(pg), sequence),
  ),
]

// Every handler piped through the wrappers the whole app shares, innermost first, and given its infrastructure.
const app = kronos({
  commandHandlers: handlers
    .map((slice) => slice.commandHandlers)
    .flat()
    .map((handler) => ({
      ...handler,
      handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
      eventStore,
      commandBus,
      queryBus,
    })),
  queryHandlers: handlers
    .map((slice) => slice.queryHandlers)
    .flat()
    .map((handler) => ({
      ...handler,
      handler: pipe(
        handler.handler,
        (next) => postgresHandler(next, pg),
        (next) => validatingHandler(next, handler.descriptor),
      ),
      queryBus,
    })),
  eventHandlers: handlers
    .map((slice) => slice.eventHandlers)
    .flat()
    .map((handler) => ({
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
