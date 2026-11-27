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

// The infrastructure, built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

/** Kronos's `eventProcessor` with the stores applied: a slice gives it only a name. */
export const eventProcessor = (name: string) =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

/** Kronos's `deadLettering` with the dead-letter queue applied: a slice gives it its processor and its sequence. */
export const deadLettering = (processor: EventProcessor, sequence: Sequence) =>
  coreDeadLettering(processor, postgresDeadLetterQueue(pg), sequence)

// Postgres: the events, positions, dead letters and read models, in one database.
export const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

export const eventStore = postgresEventStore(pg)
export const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
export const queryBus = localQueryBus(unitOfWork)

export const close = async () => {
  await pg.close()
}
