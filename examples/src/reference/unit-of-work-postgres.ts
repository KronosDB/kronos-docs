import {
  type CommandHandlerContext,
  type EventHandlerContext,
  commandHandler,
  eventHandler,
  eventProcessor,
  interceptingCommandBus,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
  correlation,
} from "@kronos-ts/core"
import {
  type PostgresCapability,
  activePostgresTransaction,
  postgresEventStore,
  postgresHandler,
  postgresPool,
  postgresTokenStore,
  postgresTransaction,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
})

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
await pg.start()

const eventStore = postgresEventStore(pg)
const tokenStore = postgresTokenStore(pg)

// Transactional units of work for the command bus and for processors
const transactionalUnitOfWork = postgresUnitOfWork(unitOfWork, pg)
const commandBus = interceptingCommandBus(localCommandBus(transactionalUnitOfWork), correlation)
const queryBus = localQueryBus(unitOfWork)
const inventoryView = eventProcessor("inventory-view", eventStore, tokenStore, transactionalUnitOfWork)

// A command handler writes through the pool, so the write is idempotent
export const addTool = commandHandler(
  AddTool,
  async ({ payload }, ctx: CommandHandlerContext & PostgresCapability) => {
    await ctx.sql().query(
      "INSERT INTO tool_names (tool_id, name) VALUES ($1, $2) ON CONFLICT (tool_id) DO UPDATE SET name = EXCLUDED.name",
      [payload.toolId, payload.name],
    )
    ctx.append(ToolAdded, payload)
  },
)

// An event handler writes in the batch's transaction, together with the token
export const projectTool = eventHandler(
  ToolAdded,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query(
      "INSERT INTO inventory (tool_id, name, available) VALUES ($1, $2, true) ON CONFLICT (tool_id) DO NOTHING",
      [payload.toolId, payload.name],
    )
  },
)

// The accessors read the transaction without going through the wrapper
export const projectToolByHand = eventHandler(ToolAdded, async ({ payload }, ctx) => {
  const existing = activePostgresTransaction(ctx.unitOfWork)
  const transaction = existing ?? (await postgresTransaction(ctx.unitOfWork))
  await transaction.query("UPDATE inventory SET name = $2 WHERE tool_id = $1", [payload.toolId, payload.name])
})

const app = kronos({
  commandHandlers: [{ ...addTool, handler: postgresHandler(addTool.handler, pg), eventStore, commandBus, queryBus }],
  eventHandlers: [
    { ...projectTool, handler: postgresHandler(projectTool.handler, pg), commandBus, queryBus, processor: inventoryView },
  ],
})

await app.stop()
await pg.close()
