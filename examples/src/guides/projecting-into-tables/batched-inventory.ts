import { eventHandler, type UnitOfWork } from "@kronos-ts/core"
import { postgresTransaction } from "@kronos-ts/postgres"
import { ToolAdded, ToolRented, ToolReturned } from "./toolstore.js"

type Pending = {
  readonly added: Map<string, string>
  readonly availability: Map<string, boolean>
}

const pending = new WeakMap<UnitOfWork, Pending>()

function pendingFor(uow: UnitOfWork): Pending {
  const existing = pending.get(uow)
  if (existing !== undefined) return existing

  const batch: Pending = { added: new Map(), availability: new Map() }
  pending.set(uow, batch)

  uow.onPrepareCommit(async () => {
    const tx = await postgresTransaction(uow)
    if (batch.added.size > 0) {
      await tx.query(
        `INSERT INTO inventory (tool_id, name, available)
         SELECT tool_id, name, true FROM unnest($1::text[], $2::text[]) AS added(tool_id, name)
         ON CONFLICT (tool_id) DO UPDATE SET name = EXCLUDED.name`,
        [[...batch.added.keys()], [...batch.added.values()]],
      )
    }
    if (batch.availability.size > 0) {
      await tx.query(
        `UPDATE inventory SET available = changes.available
         FROM unnest($1::text[], $2::boolean[]) AS changes(tool_id, available)
         WHERE inventory.tool_id = changes.tool_id`,
        [[...batch.availability.keys()], [...batch.availability.values()]],
      )
    }
  })
  return batch
}

export const projectAddedTool = eventHandler(ToolAdded, ({ payload }, ctx) => {
  pendingFor(ctx.unitOfWork).added.set(payload.toolId, payload.name)
})

export const projectRentedTool = eventHandler(ToolRented, ({ payload }, ctx) => {
  pendingFor(ctx.unitOfWork).availability.set(payload.toolId, false)
})

export const projectReturnedTool = eventHandler(ToolReturned, ({ payload }, ctx) => {
  pendingFor(ctx.unitOfWork).availability.set(payload.toolId, true)
})
