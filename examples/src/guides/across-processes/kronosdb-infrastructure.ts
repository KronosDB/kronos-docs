import {
  eventProcessor,
  jsonSerializer,
  localCommandBus,
  localFirstCommandBus,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection, kronosDbEventStore, kronosDbQueryBus } from "@kronos-ts/kronosdb"
import { postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { migrate } from "../../toolstore/migrations"

export async function connect(componentName: string) {
  const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
  await pg.start()
  await migrate(pg)

  const kdb = await kronosDbConnection({
    host: process.env.KRONOSDB_HOST ?? "localhost",
    port: Number(process.env.KRONOSDB_PORT ?? 50051),
    context: "toolstore",
    componentName,
    serializer: jsonSerializer(),
  })

  const localCommands = localCommandBus(unitOfWork)
  const localQueries = localQueryBus(unitOfWork)

  const eventStore = kronosDbEventStore(kdb, "toolstore")

  return {
    eventStore,
    commandBus: localFirstCommandBus(kronosDbCommandBus(localCommands, kdb, "toolstore"), localCommands),
    queryBus: localFirstQueryBus(kronosDbQueryBus(localQueries, kdb, "toolstore"), localQueries),
    eventProcessor: (name: string) =>
      eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
    pg,
    start: () => kdb.start(),
    async close() {
      await kdb.close()
      await pg.close()
    },
  }
}
