import { postgresPool } from "@kronos-ts/postgres"
import { pgAdapter } from "@kronos-ts/postgres/adapters/pg"

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore"

// Pool size and timeouts are set on the adapter.
export const pooled = postgresPool(pgAdapter({ connectionString, poolConfig: { max: 20 } }))

// Migrations run elsewhere: the pool connects and creates nothing.
export const migrated = postgresPool(connectionString, { bootstrap: false })
