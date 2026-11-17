import {
  FIRST_TOKEN,
  LATEST_TOKEN,
  advanceToken,
  deserializeToken,
  emptyMetadata,
  eventHandler,
  eventProcessor,
  globalSequenceToken,
  inMemoryEventStore,
  inMemoryTokenStore,
  isReplayToken,
  isReplaying,
  kronos,
  localCommandBus,
  localQueryBus,
  replayToken,
  serializeToken,
  tagsOf,
  unitOfWork,
  unwrapToken,
  wasProcessedBeforeReset,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

// Tokens are immutable values with a position
const afterThree = globalSequenceToken(3n)
console.log(afterThree.position(), afterThree.covers(FIRST_TOKEN), FIRST_TOKEN.covers(afterThree))
console.log(afterThree.lowerBound(globalSequenceToken(1n)).position())
console.log(afterThree.upperBound(globalSequenceToken(9n)).position())
console.log(LATEST_TOKEN.kind, LATEST_TOKEN.covers(afterThree))

// A replay token wraps the progress of a replay and where the processor had got to
const midReplay = replayToken(globalSequenceToken(10n), globalSequenceToken(4n))
console.log(isReplayToken(midReplay), isReplaying(midReplay), unwrapToken(midReplay).position())
console.log(wasProcessedBeforeReset(midReplay, 7n), wasProcessedBeforeReset(midReplay, 12n))

// Advancing past the reset point drops the wrapper
console.log(isReplayToken(advanceToken(midReplay, 6n)), isReplayToken(advanceToken(midReplay, 10n)))

// A token is stored as a type and a JSON body
const stored = serializeToken(midReplay)
console.log(stored)
console.log(deserializeToken(stored.type, stored.data)?.kind)

// Starting a new processor at the head of the log instead of the start
const eventStore = inMemoryEventStore()
const tokenStore = inMemoryTokenStore()

async function addTool(toolId: string, model: string, name: string) {
  const payload = { toolId, model, name }
  await eventStore.append([
    {
      kind: "event",
      identifier: crypto.randomUUID(),
      name: ToolAdded.name,
      version: ToolAdded.version,
      payload,
      metadata: emptyMetadata(),
      timestamp: Date.now(),
      tags: tagsOf(ToolAdded, payload, emptyMetadata()),
    },
  ])
}

await addTool("t-1", "DCD791", "Cordless drill")
await tokenStore.store("inventory-view", 0, await eventStore.latestToken())

const seen: string[] = []
const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  seen.push(payload.toolId)
})

const inventoryView = eventProcessor("inventory-view", eventStore, tokenStore, unitOfWork)
const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const app = kronos({
  eventHandlers: [{ ...recordAddedTool, commandBus, queryBus, processor: inventoryView }],
})

await addTool("t-2", "D24000", "Tile saw")
await new Promise((resolve) => setTimeout(resolve, 100))
await app.stop()
console.log(seen)
