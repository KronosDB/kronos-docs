import { is, type Upcast } from "@kronos-ts/core"
import { ToolAdded, ToolAddedV1 } from "./descriptors.js"

export const categoryAdded: Upcast = (event) => {
  if (is(event, ToolAddedV1)) {
    return { ...event, version: ToolAdded.version, payload: { ...event.payload, category: "uncategorised" } }
  }
  return event
}
