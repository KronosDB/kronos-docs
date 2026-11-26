import {
  MetadataKeys,
  emptyMetadata,
  generateIdentifier,
  is,
  jsonSerializer,
  mergeMetadata,
  metadataAnd,
  metadataAndIfNotPresent,
  metadataContains,
  metadataSubset,
  metadataWith,
  metadataWithoutKeys,
  qn,
  qualifiedNameFromString,
  qualifiedNameToString,
  qualifiedNamesEqual,
  withNamespace,
  type CommandMessage,
  type EventMessage,
  type Message,
  type Metadata,
  type SequencedEventMessage,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

// Metadata
const base: Metadata = metadataWith("actor", "staff-4")
const traced = metadataAnd(base, MetadataKeys.TRACE_ID, "4bf92f3577b34da6a3ce929d0e0e4736")
const withBranch = metadataAndIfNotPresent(traced, "branch", () => "north")
const merged = mergeMetadata(withBranch, { actor: "staff-7" })
console.log(merged)
console.log(metadataSubset(merged, "actor", "branch"))
console.log(metadataWithoutKeys(merged, "actor"))
console.log(metadataContains(merged, MetadataKeys.CORRELATION_ID), emptyMetadata())

// Message shapes
const rentCommand: CommandMessage = {
  kind: "command",
  identifier: generateIdentifier(),
  name: RentTool.name,
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: { actor: "staff-4" },
}

const toolRented: EventMessage = {
  kind: "event",
  identifier: generateIdentifier(),
  name: ToolRented.name,
  version: ToolRented.version,
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: {},
  timestamp: Date.now(),
}

const delivered: SequencedEventMessage = { ...toolRented, sequence: 42n }

// Matching a message against a descriptor
function describeMessage(message: Message): string {
  if (is(message, RentTool)) return `rent ${message.payload.toolId} for ${message.payload.customerId}`
  if (is(message, ToolRented)) return `${message.payload.toolId} rented at ${message.timestamp}`
  return "unknown message"
}
console.log(describeMessage(rentCommand), describeMessage(delivered))

// Qualified names
const name = qn("toolstore", "RentTool")
console.log(qualifiedNameToString(name), qualifiedNameFromString("toolstore.billing.InvoiceSent"))
console.log(qualifiedNamesEqual(name, RentTool.name))

// Serialization
const serializer = jsonSerializer()
const serialized = serializer.serialize(rentCommand.payload, qualifiedNameToString(RentTool.name), RentTool.version)
console.log(serialized.type, serialized.revision, serializer.deserialize(serialized))
