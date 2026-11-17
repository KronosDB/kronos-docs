import {
  correlation,
  interceptingQueryBus,
  jsonSerializer,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { kronosDbConnection, kronosDbQueryBus } from "@kronos-ts/kronosdb"

const kdb = await kronosDbConnection({ componentName: "toolstore", serializer: jsonSerializer() })

const local = localQueryBus(unitOfWork)
const remote = kronosDbQueryBus(local, kdb, "toolstore", { timeoutMs: 10_000 })

export const queryBus = interceptingQueryBus(localFirstQueryBus(remote, local), correlation)
