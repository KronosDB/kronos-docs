import type { PostgresResource } from "@kronos-ts/postgres"
import { createInventoryTable } from "./slices/toolstore/inventory/table"

/** Every table the slices write, in the order they were added. */
const migrations = [createInventoryTable]

export async function migrate(pg: PostgresResource): Promise<void> {
  for (const statement of migrations) await pg.query(statement)
}
