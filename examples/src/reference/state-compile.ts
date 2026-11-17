import { compileQuery, queryItems, resolveTypeName, withNamespace, type EventQuery } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const query: EventQuery = [
  { tags: { toolId: "t-1" }, types: [ToolRented] },
  { tags: { customerId: "ada" } },
]

console.log(queryItems(query).length)
console.log(resolveTypeName(ToolRented), resolveTypeName("toolstore.ToolRented"))
console.log(JSON.stringify(compileQuery(query), null, 2))
