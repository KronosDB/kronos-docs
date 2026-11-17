import type { CommandHandler, EventHandler, QueryHandler } from "@kronos-ts/core"

export type Slice = {
  commandHandlers: CommandHandler<any, any>[]
  queryHandlers: QueryHandler<any, any>[]
  eventHandlers: { processor: string; handler: EventHandler<any> }[]
}

export function slice(parts: Partial<Slice>): Slice {
  return {
    commandHandlers: parts.commandHandlers ?? [],
    queryHandlers: parts.queryHandlers ?? [],
    eventHandlers: parts.eventHandlers ?? [],
  }
}
