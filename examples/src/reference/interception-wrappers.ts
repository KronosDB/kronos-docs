import {
  type CommandHandlerContext,
  commandHandler,
  describe,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const ReturnTool = ns.command("ReturnTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

type AnyHandler = (message: any, context: any) => any

// A wrapper that changes nothing about the context
export function timedHandler<H extends AnyHandler>(next: H) {
  return async (message: Parameters<H>[0], context: Parameters<H>[1]) => {
    const started = performance.now()
    try {
      return await next(message, context)
    } finally {
      console.log(`${message.name.name} took ${(performance.now() - started).toFixed(1)} ms`)
    }
  }
}

// A wrapper that adds ctx.actor, and says so
export type ActorCapability = { readonly actor: string }

export function actorHandler<H extends (message: any, context: any) => any>(next: H) {
  const wrapped = (message: Parameters<H>[0], context: Omit<Parameters<H>[1], "actor">) =>
    next(message, { ...context, actor: String(message.metadata.actor ?? "unknown") }) as ReturnType<H>
  return describe(wrapped, { name: "actorHandler", supplies: ["actor"], reads: ["message.metadata"], next })
}

export const returnTool = commandHandler(
  ReturnTool,
  async ({ payload }, ctx: CommandHandlerContext & ActorCapability) => {
    console.log(`${ctx.actor} returned ${payload.toolId}`)
    ctx.append(ToolReturned, payload)
  },
)

const commandBus = localCommandBus(unitOfWork)
const app = kronos({
  commandHandlers: [
    {
      ...returnTool,
      // the last wrapper written is the first to run
      handler: timedHandler(actorHandler(returnTool.handler)),
      eventStore: inMemoryEventStore(),
      commandBus,
      queryBus: localQueryBus(unitOfWork),
    },
  ],
})

await send(commandBus, ReturnTool, { toolId: "t-1", customerId: "ada" }, { actor: "staff-4" })
await app.stop()
