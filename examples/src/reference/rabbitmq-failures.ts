import {
  isConflict,
  isNoHandler,
  isUnavailable,
  localCommandBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { rabbitMqCommandBus, rabbitMqConnection } from "@kronos-ts/rabbitmq"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

const rabbit = await rabbitMqConnection("amqp://rabbitmq.internal:5672", {
  serviceName: "toolstore-counter",
  instanceId: "counter-1",
})
const commandBus = rabbitMqCommandBus(localCommandBus(unitOfWork), rabbit)

export async function suspend(customerId: string) {
  try {
    await send(commandBus, SuspendCustomer, { customerId, reason: "overdue" })
    return "suspended"
  } catch (error) {
    if (isNoHandler(error)) return "nobody-handles-it"
    if (isUnavailable(error)) return "outcome-unknown-or-retry"
    if (isConflict(error)) return "conflict"
    if (error instanceof Error) return `${error.name}: ${error.message}`
    throw error
  }
}
