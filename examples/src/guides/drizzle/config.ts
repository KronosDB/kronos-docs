import {
  eventProcessor as coreEventProcessor,
  type EventProcessor,
  localCommandBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { postgresEventStore, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

// The infrastructure, every piece built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore"

// The migrations drizzle-kit generated from the slices' schemas, applied before the app starts.
const migrator = drizzle(databaseUrl)
await migrate(migrator, { migrationsFolder: new URL("./migrations", import.meta.url).pathname })
await migrator.$client.end()

export const pg = postgresPool(databaseUrl)
await pg.start()

export const eventStore = postgresEventStore(pg)
export const commandBus = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
export const queryBus = localQueryBus(unitOfWork)

/** Kronos's `eventProcessor` with this process's stores applied: a slice gives it only a name. */
export const eventProcessor = (name: string): EventProcessor =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

/** Closes what this file opened, after the app has stopped. */
export const close = async () => {
  await pg.close()
}
