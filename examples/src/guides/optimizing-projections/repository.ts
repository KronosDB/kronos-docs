import type { UnitOfWork } from "@kronos-ts/core"
import type { PostgresCapability } from "@kronos-ts/postgres"
import { getTableColumns, inArray, sql } from "drizzle-orm"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"
import type { PoolClient } from "pg"

type Row<Table extends PgTable> = Table["$inferSelect"]

/** A table as one batch sees it. It reads and writes Postgres once per batch, not once per event. */
export type Repository<Table extends PgTable> = {
  /** The row as this batch has it: saved earlier in the batch, else stored, else `undefined`. */
  get(id: string): Promise<Row<Table> | undefined>
  /** Keeps the row for the batch. Every saved row is written in one statement before the batch commits. */
  save(row: Row<Table>): void
}

export type Repositories<Tables extends Record<string, PgTable>> = { readonly [Name in keyof Tables]: Repository<Tables[Name]> }

type AnyRow = Record<string, unknown>

/** One table within one batch. */
type Kept = {
  readonly table: PgTable
  readonly key: PgColumn
  readonly keyName: string
  /** Every row the batch has read or saved, by key. */
  readonly rows: Map<string, AnyRow | undefined>
  /** The keys whose rows the batch saved. */
  readonly saved: Set<string>
  /** The keys asked for in this turn of the event loop, and the handlers waiting for them. */
  readonly wanted: Map<string, Array<(row: AnyRow | undefined) => void>>
}

const batches = new WeakMap<UnitOfWork, Map<PgTable, Kept>>()

/**
 * Gives a handler one repository per table, as `ctx.<name>`. Goes inside `postgresHandler`, which supplies the
 * batch's transaction. The first handler of a batch registers the write, which runs once before the batch commits.
 */
export function repositoryHandler<Tables extends Record<string, PgTable>, M, C extends Repositories<Tables>>(
  next: (message: M, context: C) => Promise<void> | void,
  tables: Tables,
) {
  return async (message: M, context: Omit<C, keyof Tables> & PostgresCapability & { readonly unitOfWork: UnitOfWork }) => {
    const db = drizzle(context.sql().unwrap<PoolClient>())
    const batch = batchOf(context.unitOfWork, db, Object.values(tables))
    const repositories = Object.fromEntries(
      Object.entries(tables).map(([name, table]) => [name, repository(db, batch.get(table)!)]),
    )
    await next(message, { ...context, ...repositories } as unknown as C)
  }
}

function batchOf(uow: UnitOfWork, db: NodePgDatabase, tables: PgTable[]): Map<PgTable, Kept> {
  const existing = batches.get(uow)
  if (existing !== undefined) return existing
  const batch = new Map(tables.map((table) => [table, kept(table)]))
  batches.set(uow, batch)
  uow.onPrepareCommit(async () => {
    for (const table of batch.values()) await write(db, table)
  })
  return batch
}

function kept(table: PgTable): Kept {
  const [keyName, key] = Object.entries(getTableColumns(table)).find(([, column]) => column.primary)!
  return { table, key, keyName, rows: new Map(), saved: new Set(), wanted: new Map() }
}

function repository(db: NodePgDatabase, table: Kept): Repository<PgTable> {
  return {
    get(id) {
      if (table.rows.has(id)) return Promise.resolve(table.rows.get(id))
      return new Promise((answer) => {
        const first = table.wanted.size === 0
        table.wanted.set(id, [...(table.wanted.get(id) ?? []), answer])
        // Every row asked for in this turn is read in one select.
        if (first) setImmediate(() => void read(db, table))
      })
    },
    save(row) {
      const id = String((row as AnyRow)[table.keyName])
      table.rows.set(id, row as AnyRow)
      table.saved.add(id)
    },
  }
}

async function read(db: NodePgDatabase, table: Kept): Promise<void> {
  const wanted = new Map(table.wanted)
  table.wanted.clear()
  const found = (await db.select().from(table.table).where(inArray(table.key, [...wanted.keys()]))) as AnyRow[]
  for (const row of found) {
    const id = String(row[table.keyName])
    if (!table.rows.has(id)) table.rows.set(id, row)
  }
  for (const [id, waiting] of wanted) {
    if (!table.rows.has(id)) table.rows.set(id, undefined)
    for (const answer of waiting) answer(table.rows.get(id))
  }
}

/** One upsert for every row the batch saved. */
async function write(db: NodePgDatabase, table: Kept): Promise<void> {
  if (table.saved.size === 0) return
  const others = Object.entries(getTableColumns(table.table)).filter(([, column]) => column !== table.key)
  await db
    .insert(table.table)
    .values([...table.saved].map((id) => table.rows.get(id)!) as never)
    .onConflictDoUpdate({
      target: table.key,
      set: Object.fromEntries(others.map(([name, column]) => [name, sql`excluded.${sql.identifier(column.name)}`])),
    })
}
