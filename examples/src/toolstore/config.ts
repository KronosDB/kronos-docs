import {
  deadLettering as coreDeadLettering,
  eventProcessor as coreEventProcessor,
  type EventProcessor,
  localCommandBus,
  localQueryBus,
  type Sequence,
  unitOfWork,
} from "@kronos-ts/core"
import {
  postgresDeadLetterQueue,
  postgresEventStore,
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { migrate } from "./migrations"

// The infrastructure, every piece built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

// Postgres: the events, the processors' positions, the dead letters and the read models, in one database.
export const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

export const eventStore = postgresEventStore(pg)
export const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
export const queryBus = localQueryBus(unitOfWork)

/** Kronos's `eventProcessor` with this process's stores applied: a slice gives it only a name. */
export const eventProcessor = (name: string): EventProcessor =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

/** Kronos's `deadLettering` with this process's dead-letter queue applied: a slice gives it its processor and sequence. */
export const deadLettering = (processor: EventProcessor, sequence: Sequence): EventProcessor =>
  coreDeadLettering(processor, postgresDeadLetterQueue(pg), sequence)

/** Closes what this file opened, after the app has stopped. */
export const close = async () => {
  await pg.close()
}
