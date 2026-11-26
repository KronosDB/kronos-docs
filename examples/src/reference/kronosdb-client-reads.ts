import { jsonSerializer } from "@kronos-ts/core"
import {
  kronosDbConnection,
  kronosDbEventStore,
  kronosDbPositionAt,
  kronosDbSchedulingEventStore,
  kronosDbSubscription,
  kronosDbTail,
} from "@kronos-ts/kronosdb"

const kdb = await kronosDbConnection({ componentName: "toolstore-reports", serializer: jsonSerializer() })

export async function firstEventOfTheDay(day: Date) {
  const tail = await kronosDbTail(kdb, "toolstore")
  const position = await kronosDbPositionAt(kdb, "toolstore", day)
  if (position === undefined) return undefined
  return { tail, position }
}

export function watchQuietly() {
  const stream = kronosDbSubscription(
    kdb,
    "toolstore",
    { position: 0n },
    { progressIntervalMs: 1_000, excludeNames: ["toolstore.ToolReturned"] },
  )
  return stream.progress()
}

export function openAtPosition() {
  const eventStore = kronosDbEventStore(kdb, "toolstore", { progressIntervalMs: 500 })
  return eventStore.open({ position: 100n })
}

export async function pendingSchedules() {
  const eventStore = kronosDbSchedulingEventStore(kronosDbEventStore(kdb, "toolstore"), kdb, "toolstore")
  const pending = await eventStore.listSchedules()
  return pending.map((schedule) => `${schedule.token} fires ${new Date(schedule.dueAt).toISOString()}`)
}
