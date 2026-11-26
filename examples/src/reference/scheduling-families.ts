import { batched, jsonSerializer, polling, unitOfWork } from "@kronos-ts/core"
import { kronosDbConnection, kronosDbEventStore, kronosDbSchedulingEventStore } from "@kronos-ts/kronosdb"
import { postgresEventStore, postgresPool, postgresSchedulingEventStore, postgresUnitOfWork } from "@kronos-ts/postgres"

// Postgres: a table of pending schedules and a polling worker.
const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
await pg.start()
const uow = postgresUnitOfWork(unitOfWork, pg)

const postgresStore = postgresSchedulingEventStore(postgresEventStore(pg), pg, uow)

// The worker is started by the host. `polling` and `batched` tune it.
const worker = polling(batched(postgresStore, 100), 250)
await worker.startScheduling()
await worker.stopScheduling()

// KronosDB: the server holds the schedule and appends the event when it is due.
const kdb = await kronosDbConnection({ componentName: "toolstore", serializer: jsonSerializer() })
const kronosDbStore = kronosDbSchedulingEventStore(kronosDbEventStore(kdb, "toolstore"), kdb)

const pending = await kronosDbStore.listSchedules()
const token = await kronosDbStore.scheduleIdempotent(
  {
    event: {
      kind: "event",
      identifier: "overdue-t-1-ada",
      name: { namespace: "toolstore", name: "RentalOverdue" },
      version: "1.0",
      payload: { toolId: "t-1", customerId: "ada" },
      metadata: {},
      timestamp: Date.now(),
    },
    tags: [
      { key: "toolId", value: "t-1" },
      { key: "customerId", value: "ada" },
    ],
  },
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  "overdue-t-1-ada",
)
console.log(pending.length, token.id)
