import {
  eventProcessor as coreEventProcessor,
  type EventProcessor,
  jsonSerializer,
  localCommandBus,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection, kronosDbEventStore, kronosDbQueryBus } from "@kronos-ts/kronosdb"
import { postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { migrate } from "../../toolstore/migrations"

// The infrastructure, every piece built and configured here and nowhere else. `main.ts` wires the app's handlers to it.

// Postgres: the read models, the processors' positions and the dead letters.
export const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
await pg.start()
await migrate(pg)

// KronosDB: the event log and both buses, over one connection. `main.ts` starts it once every handler is subscribed.
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

/** Kronos's `eventProcessor` over the KronosDB log, with its positions and its unit of work in Postgres. */
export const eventProcessor = (name: string): EventProcessor =>
  coreEventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))

/** Closes what this file opened, after the app has stopped: the connection first, which drains the buses, then the pool. */
export const close = async () => {
  await kdb.close()
  await pg.close()
}
