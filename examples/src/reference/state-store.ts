import {
  INFINITY,
  ORIGIN,
  appendCondition,
  emptyMetadata,
  generateIdentifier,
  inMemoryEventStore,
  isConflict,
  tagsOf,
  withNamespace,
  type EventMessage,
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

function toolRented(toolId: string, customerId: string): EventMessage {
  const payload = { toolId, customerId }
  return {
    kind: "event",
    identifier: generateIdentifier(),
    name: ToolRented.name,
    version: ToolRented.version,
    payload,
    metadata: emptyMetadata(),
    timestamp: Date.now(),
    tags: tagsOf(ToolRented, payload, emptyMetadata()),
  }
}

const eventStore = inMemoryEventStore()
const query = { tags: { toolId: "t-1" }, types: [ToolRented] }

// An empty log: the read reaches no position, and its marker is the position before the first.
const empty = await eventStore.source({ query })
console.log(empty.events.length, empty.marker.position)

// An unconditional append returns the marker of the last event written.
const first = await eventStore.append([toolRented("t-1", "ada")])
console.log(first.position)

// A condition built from the earlier read says "nothing matching query after position -1".
try {
  await eventStore.append([toolRented("t-1", "linus")], appendCondition(query, empty.marker))
} catch (error) {
  console.log(isConflict(error), (error as Error).name)
}

// Reading again gives a marker that covers the event just stored, so this append passes.
const current = await eventStore.source({ query })
await eventStore.append([toolRented("t-1", "linus")], appendCondition(query, current.marker))

// INFINITY is later than every event, so nothing can conflict. ORIGIN is earlier than every
// event, so any match conflicts; here no event carries t-2 yet.
await eventStore.append([toolRented("t-1", "grace")], appendCondition(query, INFINITY))
await eventStore.append([toolRented("t-2", "grace")], appendCondition({ tags: { toolId: "t-2" } }, ORIGIN))
