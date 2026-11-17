import { event, qn, tag, tagKeysOf, tagsFromRecord, tagsOf, withNamespace, type Tag } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ToolsRented = ns.event("ToolsRented", {
  payload: z.object({
    customerId: z.string(),
    toolIds: z.array(z.string()),
    expedite: z.boolean(),
  }),
  tags: {
    customerId: (payload) => payload.customerId,
    toolId: (payload) => payload.toolIds,
    counter: (payload) => (payload.expedite ? "express" : undefined),
    branch: (_payload, metadata) => (typeof metadata.branch === "string" ? metadata.branch : undefined),
  },
})

console.log(tagKeysOf(ToolsRented))

const tags: Tag[] = tagsOf(
  ToolsRented,
  { customerId: "ada", toolIds: ["t-1", "t-2", "t-1"], expedite: false },
  { branch: "north" },
)
console.log(tags)

const express = tagsOf(ToolsRented, { customerId: "ada", toolIds: ["t-3"], expedite: true }, {})
console.log(express.map((entry) => `${entry.key}=${entry.value}`))

// Building tags by hand
const single = tag("toolId", "t-1")
const several = tagsFromRecord({ toolId: "t-1", customerId: "ada" })
console.log(single, several)

// An event without a tags record carries no tags
export const StoreOpened = event({
  name: qn("toolstore", "StoreOpened"),
  payload: z.object({ day: z.string() }),
})
console.log(tagKeysOf(StoreOpened))
