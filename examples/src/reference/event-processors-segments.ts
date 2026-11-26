import {
  batched,
  concurrent,
  emptyMetadata,
  eventHandler,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  isUnableToClaimToken,
  kronos,
  localCommandBus,
  localQueryBus,
  polling,
  segmented,
  tagsOf,
  unitOfWork,
  withNamespace,
  type Sequence,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const byCustomerId: Sequence = (event) =>
  (event.payload as { customerId?: string }).customerId ?? event.identifier

const handled: Array<{ node: string; customerId: string }> = []

function recordRental(node: string) {
  return eventHandler(ToolRented, ({ payload }) => {
    handled.push({ node, customerId: payload.customerId })
  })
}

// Two nodes share an event store and a token store, and name the same processor
const eventStore = inMemoryEventStore()
const tokenStore = inMemoryTokenStore(200)

function node(label: string) {
  const processor = segmented(
    concurrent(polling(batched(eventProcessor("customer-rentals", eventStore, tokenStore, unitOfWork), 100), 10), byCustomerId),
    4,
    byCustomerId,
  )
  const commandBus = localCommandBus(unitOfWork)
  const queryBus = localQueryBus(unitOfWork)
  return kronos({
    eventHandlers: [{ ...recordRental(label), commandBus, queryBus, processor }],
  })
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function rent(toolId: string, customerId: string) {
  const payload = { toolId, customerId }
  await eventStore.append([
    {
      event: {
        kind: "event",
        identifier: crypto.randomUUID(),
        name: ToolRented.name,
        version: ToolRented.version,
        payload,
        metadata: emptyMetadata(),
        timestamp: Date.now(),
      },
      tags: tagsOf(ToolRented, payload, emptyMetadata()),
    },
  ])
}

const first = node("first")
await wait(50)
const second = node("second")
await wait(50)

// The first node to start holds every segment
const firstProcessor = first.processors.get("customer-rentals")!
const secondProcessor = second.processors.get("customer-rentals")!
console.log(firstProcessor.segments().map((segment) => segment.segment))
console.log(secondProcessor.segments().map((segment) => segment.segment))

// It lets two of them go; the other node claims them on its next claim round
await firstProcessor.releaseSegment(2)
await firstProcessor.releaseSegment(3)
await wait(500)
console.log(firstProcessor.segments().map((segment) => [segment.segment, segment.mask]))
console.log(secondProcessor.segments().map((segment) => [segment.segment, segment.mask]))

for (const customerId of ["ada", "linus", "grace", "ada", "linus", "grace"]) await rent("t-1", customerId)
await wait(200)
console.log(new Set(handled.map((entry) => entry.node)))

// Split a segment in two, then merge the halves back
await firstProcessor.splitSegment(0)
console.log(firstProcessor.segments().map((segment) => [segment.segment, segment.mask]))
await firstProcessor.mergeSegment(0)
console.log(firstProcessor.segments().map((segment) => [segment.segment, segment.mask]))

// A node that lost its claim is refused when it writes a token
try {
  await tokenStore.store("customer-rentals", 0, await eventStore.latestToken(), undefined, "someone-else")
} catch (error) {
  console.log(isUnableToClaimToken(error))
}

await Promise.all([first.stop(), second.stop()])
