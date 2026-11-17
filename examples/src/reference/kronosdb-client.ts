import {
  commandHandler,
  jsonSerializer,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  queryHandler,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import {
  kronosDbCommandBus,
  kronosDbConnection,
  kronosDbEventStore,
  kronosDbQueryBus,
  kronosDbSchedulingEventStore,
  kronosDbSnapshottingEventStore,
} from "@kronos-ts/kronosdb"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  ctx.append(ToolAdded, payload)
})

export const getInventory = queryHandler(GetInventory, () => [])

export async function run(token: string) {
  const kdb = await kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    host: "kronosdb.internal",
    port: 50051,
    context: "toolstore",
    token,
  })

  const eventStore = kronosDbSchedulingEventStore(
    kronosDbSnapshottingEventStore(kronosDbEventStore(kdb, "toolstore"), kdb, "toolstore"),
    kdb,
    "toolstore",
  )
  const commandBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore")
  const queryBus = kronosDbQueryBus(localQueryBus(unitOfWork), kdb, "toolstore")

  const app = kronos({
    commandHandlers: [{ ...addTool, eventStore, commandBus, queryBus }],
    queryHandlers: [{ ...getInventory, eventStore, queryBus }],
  })

  await kdb.start()

  await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
  const inventory = await query(queryBus, GetInventory, {})

  await app.stop()
  await kdb.close()
  return inventory
}
