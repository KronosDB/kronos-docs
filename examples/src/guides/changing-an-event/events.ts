import { withNamespace } from "@kronos-ts/core"
import { z } from "zod"

export const ns = withNamespace("toolstore")

// The shape in the log before the change: no category.
export const ToolAddedV1 = ns.event("ToolAdded", {
  version: "1.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

// The shape every new event is written in.
export const ToolAdded = ns.event("ToolAdded", {
  version: "2.0",
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string(), category: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})
