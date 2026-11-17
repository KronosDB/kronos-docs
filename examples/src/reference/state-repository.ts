import {
  eventSourcedRepository,
  inMemoryEventStore,
  repositoryFor,
} from "@kronos-ts/core"
import { ToolAdded, Tool } from "./state.js"

const eventStore = inMemoryEventStore()

await eventStore.append([
  {
    kind: "event",
    identifier: "e-1",
    name: ToolAdded.name,
    version: ToolAdded.version,
    payload: { toolId: "t-1", model: "DCD791", name: "Cordless drill" },
    metadata: {},
    timestamp: Date.now(),
    tags: [{ key: "toolId", value: "t-1" }],
  },
])

const repository = eventSourcedRepository(Tool, eventStore)
const loaded = await repository.load({ toolId: "t-1" })
console.log(loaded.state, loaded.sourcingInfo)

// repositoryFor returns the same repository for the same state and store.
console.log(repositoryFor(Tool, eventStore) === repositoryFor(Tool, eventStore))
