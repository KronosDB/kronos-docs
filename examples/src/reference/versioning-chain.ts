import {
  afterEvents,
  inMemoryEventStore,
  inMemorySnapshottingEventStore,
  snapshot,
  state,
  upcast,
  upcastingEventStore,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolAddedV1 = ns.event("ToolAdded", {
  version: "1.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const ToolAddedV2 = ns.event("ToolAdded", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string(), category: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

export const ToolAdded = ns.event("ToolAdded", {
  version: "3.0",
  payload: z.object({
    toolId: z.string(),
    model: z.string(),
    name: z.string(),
    category: z.string(),
    serialNumber: z.string().optional(),
  }),
  tags: { toolId: (payload) => payload.toolId },
})

// One upcast per step. An event goes through every step that applies to it.
const toV2 = upcast(ToolAddedV1, ToolAddedV2, (payload) => ({ ...payload, category: "uncategorized" }))
const toV3 = upcast(ToolAddedV2, ToolAdded, (payload) => payload)

export const Tool = snapshot(
  state({
    id: { toolId: z.string() },
    tags: (id) => ({ toolId: id.toolId }),
    evolve: [() => ({ exists: false }), [ToolAdded, (tool) => ({ ...tool, exists: true })]],
  }),
  "tool-v2",
  afterEvents(100),
)

// Upcasting outermost: every event that reaches a fold has been converted.
export const eventStore = upcastingEventStore(
  inMemorySnapshottingEventStore(inMemoryEventStore()),
  [toV2, toV3],
)
