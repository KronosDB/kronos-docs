import {
  eventProcessor as coreEventProcessor,
  jsonSerializer,
  localCommandBus,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection, kronosDbEventStore, kronosDbQueryBus } from "@kronos-ts/kronosdb"
import { postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { migrate } from "../../toolstore/migrations"

// The infrastructure, built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

/** Kronos's `eventProcessor` over the KronosDB log, with its positions and unit of work in Postgres. */
export const eventProcessor = (name: string) =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

// Postgres: the read models, the processors' positions and the dead letters.
export const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

// KronosDB: one connection for the event log and both buses. `main.ts` starts it once every handler is subscribed.
export const kdb = await kronosDbConnection({
  host: process.env.KRONOSDB_HOST ?? "localhost",
  port: Number(process.env.KRONOSDB_PORT ?? 50051),
  context: "toolstore",
  componentName: "toolstore",
  serializer: jsonSerializer(),
})

export const eventStore = kronosDbEventStore(kdb, "toolstore")
export const commandBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore")
const localQueries = localQueryBus(unitOfWork)
export const queryBus = localFirstQueryBus(kronosDbQueryBus(localQueries, kdb, "toolstore"), localQueries)

// The connection first, which drains the buses, then the pool.
export const close = async () => {
  await kdb.close()
  await pg.close()
}
