import {
  inMemoryEventStore,
  inMemorySnapshottingEventStore,
  upcastingEventStore,
  type Upcast,
} from "@kronos-ts/core"

const upcast: Upcast = (event) => event

// Upcasting outermost: every event that reaches a fold has been converted.
export const eventStore = upcastingEventStore(
  inMemorySnapshottingEventStore(inMemoryEventStore()),
  upcast,
)
