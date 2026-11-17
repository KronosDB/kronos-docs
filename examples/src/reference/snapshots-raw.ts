import {
  inMemoryEventStore,
  emptyMetadata,
  generateIdentifier,
  inMemorySnapshottingEventStore,
  is,
  sourcingCondition,
  tagsOf,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const eventStore = inMemorySnapshottingEventStore(inMemoryEventStore())

for (const toolId of ["t-1", "t-2"]) {
  const payload = { toolId, customerId: "ada" }
  await eventStore.append([
    {
      kind: "event",
      identifier: generateIdentifier(),
      name: ToolRented.name,
      version: ToolRented.version,
      payload,
      metadata: emptyMetadata(),
      timestamp: Date.now(),
      tags: tagsOf(ToolRented, payload, emptyMetadata()),
    },
  ])
}

const query = { tags: { customerId: "ada" }, types: [ToolRented] }
const key = "ada-rental-count-v1"

// Read: ask for the entry filed under the key. The result leads with it when it exists.
const sourced = await eventStore.source(sourcingCondition(query, undefined, { key }))
const startingCount = sourced.snapshot ? (sourced.snapshot.state as number) : 0
const count = startingCount + sourced.events.filter((event) => is(event, ToolRented)).length

// Write: file the fold at the position the read reached.
await eventStore.storeSnapshot(key, { state: count, position: sourced.marker.position })

const again = await eventStore.source(sourcingCondition(query, undefined, { key }))
console.log(again.snapshot, again.events.length)
