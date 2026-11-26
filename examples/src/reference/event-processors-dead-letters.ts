import {
  DeadLetterQueueOverflowError,
  batched,
  deadLetter,
  deadLetterBackoff,
  deadLetterReprocessor,
  deadLettering,
  emptyMetadata,
  eventHandler,
  eventProcessor,
  exponentialBackoff,
  inMemoryDeadLetterQueue,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  polling,
  tagsOf,
  unitOfWork,
  withNamespace,
  type DeadLetterBackoffPolicy,
  type Sequence,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

// One lane per customer: a customer's events stay in order, other customers carry on
const byCustomerId: Sequence = (event) =>
  (event.payload as { customerId?: string }).customerId ?? event.identifier

// A handler that fails until the customer record it needs exists
const knownCustomers = new Set<string>()
const customerRentals = new Map<string, string[]>()

export const recordRental = eventHandler(ToolRented, ({ payload }) => {
  if (!knownCustomers.has(payload.customerId)) {
    throw new Error(`customer ${payload.customerId} is not registered`)
  }
  customerRentals.set(payload.customerId, [...(customerRentals.get(payload.customerId) ?? []), payload.toolId])
})

// The queue parks failures; the backoff wrapper delays replaying a lane that keeps failing
const exponential = exponentialBackoff({ initialDelayMs: 30_000, maxDelayMs: 600_000 })
const policy: DeadLetterBackoffPolicy = (failure) =>
  failure.letter.cause.name === "ValidationError" ? "hold" : exponential(failure)

const queue = deadLetterBackoff(inMemoryDeadLetterQueue({ maxSequences: 100, maxSequenceSize: 50 }), policy)

const eventStore = inMemoryEventStore()
const customerRentalsView = deadLettering(
  polling(batched(eventProcessor("customer-rentals", eventStore, inMemoryTokenStore(), unitOfWork), 50), 20),
  queue,
  byCustomerId,
)

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const app = kronos({
  eventHandlers: [{ ...recordRental, commandBus, queryBus, processor: customerRentalsView }],
})

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

const wait = () => new Promise((resolve) => setTimeout(resolve, 150))

knownCustomers.add("ada")
await rent("t-1", "linus")
await rent("t-2", "linus")
await rent("t-3", "ada")
await wait()

// The lane for linus is parked, with the second event blocked behind the first
console.log(await queue.sequenceIdentifiers("customer-rentals"))
console.log(await queue.size("customer-rentals"))
const letters = await queue.deadLetterSequence("customer-rentals", "linus")
console.log(letters.map((letter) => [letter.cause.message, letter.diagnostics]))
console.log(customerRentals)

// The backoff has not elapsed, so a reprocess finds nothing due
const processor = app.processors.get("customer-rentals")!
console.log(await processor.reprocessDeadLetters())

// An operator makes the lane due and replays it once the customer exists
knownCustomers.add("linus")
await queue.retryNow("customer-rentals", "linus")
console.log(await processor.reprocessDeadLetters((sequenceId) => sequenceId === "linus"))
console.log(await queue.size("customer-rentals"), customerRentals)

await app.stop()

// A reprocessor drives a queue directly, for a drain pass over every lane
const standalone = inMemoryDeadLetterQueue()
await standalone.enqueue(
  "customer-rentals",
  deadLetter(
    {
      kind: "event",
      identifier: "e-1",
      name: ToolRented.name,
      version: ToolRented.version,
      payload: { toolId: "t-3", customerId: "grace" },
      metadata: emptyMetadata(),
      timestamp: Date.now(),
    },
    new Error("customer grace is not registered"),
    "grace",
  ),
)

const reprocessor = deadLetterReprocessor({
  queue: standalone,
  processingGroup: "customer-rentals",
  unitOfWork,
  replay: async (letter) => {
    console.log("replaying", letter.sequenceIdentifier)
  },
})
console.log(await reprocessor.reprocessAll())
console.log(await standalone.size("customer-rentals"))

// A full lane refuses the next letter
const small = inMemoryDeadLetterQueue({ maxSequenceSize: 1 })
const failed = (sequenceIdentifier: string) =>
  deadLetter(
    {
      kind: "event",
      identifier: crypto.randomUUID(),
      name: ToolRented.name,
      version: ToolRented.version,
      payload: { toolId: "t-1", customerId: sequenceIdentifier },
      metadata: emptyMetadata(),
      timestamp: Date.now(),
    },
    new Error("failed"),
    sequenceIdentifier,
  )
await small.enqueue("customer-rentals", failed("grace"))
try {
  await small.enqueue("customer-rentals", failed("grace"))
} catch (error) {
  console.log(error instanceof DeadLetterQueueOverflowError, (error as Error).message)
}
