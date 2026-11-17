import type { CommandBus, EventStore, SubscriptionCapableQueryBus } from "@kronos-ts/core"

export type Infrastructure = {
  readonly eventStore: EventStore
  readonly commandBus: CommandBus
  readonly queryBus: SubscriptionCapableQueryBus
  /** Resolves once the other side has acknowledged this process's handlers. */
  start(): Promise<void>
  close(): Promise<void>
}
