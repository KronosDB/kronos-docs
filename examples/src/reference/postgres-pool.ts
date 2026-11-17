import {
  bootstrapSchema,
  buildDeadLettersIndexesDDL,
  buildDeadLettersTableDDL,
  buildEventsIndexesDDL,
  buildEventsTableDDL,
  buildScheduledEventsIndexesDDL,
  buildScheduledEventsTableDDL,
  buildSnapshotsTableDDL,
  buildTokensTableDDL,
  DEFAULT_TABLE_NAMES,
  postgresPool,
} from "@kronos-ts/postgres"
import { bunSqlAdapter } from "@kronos-ts/postgres/adapters/bun-sql"
import { pgAdapter } from "@kronos-ts/postgres/adapters/pg"
import { postgresAdapter } from "@kronos-ts/postgres/adapters/postgres"

const connectionString = "postgresql://toolstore:secret@localhost:5432/toolstore"

// A connection string loads the `pg` driver when the pool starts.
export const pg = postgresPool(connectionString)
await pg.start()

// Drain the pool on shutdown.
await pg.close()

// The adapter form picks a different driver or tunes the pool.
export const tuned = postgresPool(
  pgAdapter({
    connectionString,
    poolConfig: { max: 40 },
    idleInTransactionTimeoutMs: 15_000,
    statementTimeoutMs: 60_000,
  }),
  {
    tableNames: {
      events: "toolstore_events",
      snapshots: "toolstore_snapshots",
      scheduled: "toolstore_scheduled",
      tokens: "toolstore_tokens",
      deadLetters: "toolstore_dead_letters",
    },
    resilience: { maxAttempts: 20, maxDelayMs: 10_000 },
  },
)

export const porsager = postgresPool(
  postgresAdapter({ connectionString, clientOptions: { idle_timeout: 20 } }),
)

export const bun = postgresPool(bunSqlAdapter({ connectionString }))

// With your own migration tooling, skip the bootstrap and run the DDL yourself.
export const migrated = postgresPool(connectionString, { bootstrap: false })

export const migration = [
  buildEventsTableDDL(DEFAULT_TABLE_NAMES),
  buildEventsIndexesDDL(DEFAULT_TABLE_NAMES),
  buildSnapshotsTableDDL(DEFAULT_TABLE_NAMES),
  buildScheduledEventsTableDDL(DEFAULT_TABLE_NAMES),
  buildScheduledEventsIndexesDDL(DEFAULT_TABLE_NAMES),
  buildTokensTableDDL(DEFAULT_TABLE_NAMES),
  buildDeadLettersTableDDL(DEFAULT_TABLE_NAMES),
  buildDeadLettersIndexesDDL(DEFAULT_TABLE_NAMES),
]

// Or run all of it in one call, under the schema advisory lock.
await migrated.start()
await bootstrapSchema(migrated, { tableNames: DEFAULT_TABLE_NAMES })
