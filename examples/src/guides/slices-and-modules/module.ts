import {
  eventProcessor,
  type CommandBus,
  type EventStore,
  type QueryBus,
  type TokenStore,
  type UnitOfWork,
} from "@kronos-ts/core"
import type { Slice } from "./slice"

export type Infrastructure = {
  eventStore: EventStore
  tokenStore: TokenStore
  unitOfWork: () => UnitOfWork
  commandBus: CommandBus
  queryBus: QueryBus
}

export function entriesOf(infrastructure: Infrastructure, slices: Slice[]) {
  const { eventStore, tokenStore, unitOfWork, commandBus, queryBus } = infrastructure

  const processors = new Map<string, ReturnType<typeof eventProcessor>>()
  const processorNamed = (name: string) => {
    if (!processors.has(name)) processors.set(name, eventProcessor(name, eventStore, tokenStore, unitOfWork))
    return processors.get(name)!
  }

  return {
    commandHandlers: slices
      .flatMap((each) => each.commandHandlers)
      .map((handler) => ({ ...handler, eventStore, commandBus, queryBus })),
    queryHandlers: slices
      .flatMap((each) => each.queryHandlers)
      .map((handler) => ({ ...handler, eventStore, queryBus })),
    eventHandlers: slices
      .flatMap((each) => each.eventHandlers)
      .map(({ processor, handler }) => ({ ...handler, commandBus, queryBus, processor: processorNamed(processor) })),
  }
}
