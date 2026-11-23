import type { PostgresCapability } from "@kronos-ts/postgres"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PoolClient } from "pg"

/** `ctx.db`: Drizzle over the connection of the handling's transaction. */
export type DrizzleCapability = { readonly db: NodePgDatabase }

/**
 * Gives a handler `ctx.db`. Goes inside `postgresHandler`, which supplies `ctx.sql()`. Never call
 * `db.transaction()` on it: the handling already runs in a transaction.
 */
export const drizzleHandler =
  <H extends (message: any, context: any) => any>(next: H) =>
  (message: Parameters<H>[0], context: Omit<Parameters<H>[1], "db"> & PostgresCapability): ReturnType<H> =>
    next(message, { ...context, db: drizzle(context.sql().unwrap<PoolClient>()) })

