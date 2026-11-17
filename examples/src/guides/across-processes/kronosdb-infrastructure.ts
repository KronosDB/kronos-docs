import {
  jsonSerializer,
  localCommandBus,
  localFirstCommandBus,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import {
  kronosDbCommandBus,
  kronosDbConnection,
  kronosDbEventStore,
  kronosDbQueryBus,
} from "@kronos-ts/kronosdb"
import type { Infrastructure } from "./infrastructure.js"

export async function connect(componentName: string): Promise<Infrastructure> {
  const kdb = await kronosDbConnection({
    host: process.env.KRONOSDB_HOST ?? "localhost",
    port: Number(process.env.KRONOSDB_PORT ?? 50051),
    context: "toolstore",
    componentName,
    serializer: jsonSerializer(),
  })

  const localCommands = localCommandBus(unitOfWork)
  const localQueries = localQueryBus(unitOfWork)

  return {
    eventStore: kronosDbEventStore(kdb, "toolstore"),
    commandBus: localFirstCommandBus(kronosDbCommandBus(localCommands, kdb, "toolstore"), localCommands),
    queryBus: localFirstQueryBus(kronosDbQueryBus(localQueries, kdb, "toolstore"), localQueries),
    start: () => kdb.start(),
    close: () => kdb.close(),
  }
}
