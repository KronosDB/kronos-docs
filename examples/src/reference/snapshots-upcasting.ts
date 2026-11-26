import {
  inMemoryEventStore,
  inMemorySnapshottingEventStore,
  upcast,
  upcastingEventStore,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolAddedV1 = ns.event("ToolAdded", {
  version: "1.0",
  payload: z.object({ toolId: z.string(), model: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const ToolAdded = ns.event("ToolAdded", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), model: z.string(), category: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const categoryAdded = upcast(ToolAddedV1, ToolAdded, (payload) => ({ ...payload, category: "uncategorized" }))

// Upcasting outermost: every event that reaches a fold has been converted.
export const eventStore = upcastingEventStore(
  inMemorySnapshottingEventStore(inMemoryEventStore()),
  [categoryAdded],
)
