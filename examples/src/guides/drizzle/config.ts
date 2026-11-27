import {
  eventProcessor as coreEventProcessor,
  localCommandBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { postgresEventStore, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { migrate } from "./migrate"

// The infrastructure, built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

/** Kronos's `eventProcessor` with the stores applied: a slice gives it only a name. */
export const eventProcessor = (name: string) =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore"

export const pg = postgresPool(databaseUrl)
await pg.start()
await migrate(databaseUrl)

export const eventStore = postgresEventStore(pg)
export const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
export const queryBus = localQueryBus(unitOfWork)

export const close = async () => {
  await pg.close()
}
