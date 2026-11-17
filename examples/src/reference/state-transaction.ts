import { eventStoreTransaction, emptyMetadata, withNamespace } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const transaction = eventStoreTransaction()

transaction.onAppend((event) => console.log("buffered", event.name.name))

transaction.appendEvent({
  kind: "event",
  identifier: "e-1",
  name: ToolRented.name,
  version: ToolRented.version,
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: emptyMetadata(),
  timestamp: Date.now(),
  tags: [{ key: "toolId", value: "t-1" }],
})

console.log(transaction.bufferedEvents.length)
