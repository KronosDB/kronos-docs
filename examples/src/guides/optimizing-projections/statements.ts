import { batched, type EventProcessor, eventHandler, type UnitOfWork } from "@kronos-ts/core"
import { postgresTransaction } from "@kronos-ts/postgres"
import { handle } from "../../toolstore/slices/toolstore/inventory/handler"
import { ToolAdded, ToolRented } from "../../toolstore/slices/toolstore/events"

/** What one batch changes in the inventory: the tools it adds, by name, and the tools it rents out. */
type Changes = { readonly added: Map<string, string>; readonly rented: Set<string> }

/** Each batch's changes, kept on its unit of work, so they are released with it. */
const changesOfBatch = new WeakMap<UnitOfWork, Changes>()

/**
 * The changes of the batch this unit of work runs. The first handler of a batch creates them and registers the
 * write, which runs once, after the batch's last handler and before the processor stores its position.
 */
function changesOf(uow: UnitOfWork): Changes {
  const existing = changesOfBatch.get(uow)
  if (existing !== undefined) return existing
  const changes: Changes = { added: new Map(), rented: new Set() }
  changesOfBatch.set(uow, changes)
  uow.onPrepareCommit(() => write(uow, changes))
  return changes
}

/** One statement per kind of change, in the batch's transaction. Additions go first, so a rental in the same batch finds its row. */
async function write(uow: UnitOfWork, changes: Changes): Promise<void> {
  const tx = await postgresTransaction(uow)
  if (changes.added.size > 0) {
    await tx.query(
      `INSERT INTO inventory (tool_id, name, available)
       SELECT tool_id, name, true FROM unnest($1::text[], $2::text[]) AS added(tool_id, name)
       ON CONFLICT (tool_id) DO UPDATE SET name = EXCLUDED.name`,
      [[...changes.added.keys()], [...changes.added.values()]],
    )
  }
  if (changes.rented.size > 0) {
    await tx.query(`UPDATE inventory SET available = false WHERE tool_id = ANY($1::text[])`, [[...changes.rented]])
  }
}

/** Each handler records its event's change on the batch; nothing is written until the batch commits. */
export const projection = [
  eventHandler(ToolAdded, ({ payload }, ctx) => {
    changesOf(ctx.unitOfWork).added.set(payload.toolId, payload.name)
  }),
  eventHandler(ToolRented, ({ payload }, ctx) => {
    changesOf(ctx.unitOfWork).rented.add(payload.toolId)
  }),
]

/** The inventory written with one statement per kind of change, in batches of up to 1000 events. */
export const inventoryByStatements = (eventProcessor: (name: string) => EventProcessor) => {
  const processor = batched(eventProcessor("inventory-view"), 1000)
  return {
    commandHandlers: [],
    queryHandlers: [handle],
    eventHandlers: projection.map((handler) => ({ ...handler, processor })),
  }
}
