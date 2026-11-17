import { inMemoryEventStore, inMemorySnapshottingEventStore, jsonSerializer } from "@kronos-ts/core"
import { axonServerConnection, axonServerEventStore, axonServerSnapshottingEventStore } from "@kronos-ts/axon-server"
import { kronosDbConnection, kronosDbEventStore, kronosDbSnapshottingEventStore } from "@kronos-ts/kronosdb"
import { postgresEventStore, postgresPool, postgresSnapshottingEventStore } from "@kronos-ts/postgres"

export const inMemoryStore = inMemorySnapshottingEventStore(inMemoryEventStore())

const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
export const postgresStore = postgresSnapshottingEventStore(postgresEventStore(pg), pg, jsonSerializer())

const kdb = await kronosDbConnection({ componentName: "toolstore", serializer: jsonSerializer() })
export const kronosDbStore = kronosDbSnapshottingEventStore(
  kronosDbEventStore(kdb, "toolstore"),
  kdb,
  "toolstore",
)

const axon = await axonServerConnection({ componentName: "toolstore", serializer: jsonSerializer() })
export const axonServerStore = axonServerSnapshottingEventStore(
  axonServerEventStore(axon, "toolstore"),
  axon,
  "toolstore",
)
