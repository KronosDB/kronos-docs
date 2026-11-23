import { jsonSerializer, upcastingEventStore } from "@kronos-ts/core"
import { postgresEventStore, postgresPool, postgresSnapshottingEventStore } from "@kronos-ts/postgres"
import { categoryAdded } from "./upcasts"

const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")

// In main.ts, where the event store is built: every reader of the store gets the new shape.
export const eventStore = upcastingEventStore(
  postgresSnapshottingEventStore(postgresEventStore(pg), pg, jsonSerializer()),
  categoryAdded,
  { storedTypes: (type) => [type] },
)
