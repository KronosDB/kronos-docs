import { inMemoryEventStore, type EventStore } from "@kronos-ts/core"

export function loggingEventStore<Store extends EventStore>(next: Store): Store {
  return {
    ...next,
    async source(condition) {
      const result = await next.source(condition)
      console.log(`source: ${result.events.length} events, marker ${result.marker.position}`)
      return result
    },
    async append(events, condition, uow) {
      console.log(`append: ${events.length} events, conditional ${condition !== undefined}`)
      return next.append(events, condition, uow)
    },
  }
}

export const eventStore = loggingEventStore(inMemoryEventStore())
