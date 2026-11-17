import {
  type Message,
  interceptingCommandBus,
  localCommandBus,
  send,
  unitOfWork,
  withNamespace,
  commandHandler,
  inMemoryEventStore,
  kronos,
  localQueryBus,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

export const CustomerSuspended = ns.event("CustomerSuspended", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
  tags: { customerId: (payload) => payload.customerId },
})

function labelled(label: string) {
  return <M extends Message>(message: M): M => {
    console.log(`${label} sees ${JSON.stringify(Object.keys(message.metadata))}`)
    return { ...message, metadata: { ...message.metadata, [label]: true } }
  }
}

const inner = interceptingCommandBus(localCommandBus(unitOfWork), labelled("inner"))
const commandBus = interceptingCommandBus(inner, labelled("outer"))

export const suspendCustomer = commandHandler(SuspendCustomer, async ({ payload, metadata }, ctx) => {
  console.log(`handler sees ${JSON.stringify(Object.keys(metadata))}`)
  ctx.append(CustomerSuspended, payload)
})

const app = kronos({
  commandHandlers: [
    { ...suspendCustomer, eventStore: inMemoryEventStore(), commandBus, queryBus: localQueryBus(unitOfWork) },
  ],
})

await send(commandBus, SuspendCustomer, { customerId: "ada", reason: "overdue" })
await app.stop()
