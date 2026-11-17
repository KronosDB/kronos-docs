import {
  isUnavailable,
  jsonSerializer,
  localCommandBus,
  localFirstCommandBus,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection } from "@kronos-ts/kronosdb"
import { rabbitMqCommandBus, rabbitMqConnection } from "@kronos-ts/rabbitmq"
import { z } from "zod"

const ns = withNamespace("toolstore")

const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

// RabbitMQ: handlers in this process are answered locally
const rabbit = await rabbitMqConnection("amqp://localhost", {
  serviceName: "toolstore",
  instanceId: "counter-1",
})
const local = localCommandBus(unitOfWork)
export const rabbitCommandBus = localFirstCommandBus(rabbitMqCommandBus(local, rabbit, { timeoutMs: 10_000 }), local)

// KronosDB: a request deadline and admission limits on the bus
const kdb = await kronosDbConnection({ componentName: "toolstore", serializer: jsonSerializer() })
export const kronosDbBus = kronosDbCommandBus(localCommandBus(unitOfWork), kdb, "toolstore", {
  timeoutMs: 30_000,
  limits: {
    maxConcurrentHandlers: 128,
    maxPendingRequests: 1024,
    observe: (activity) => console.log(activity.name, activity.active, activity.rejected),
  },
})

try {
  await send(kronosDbBus, SuspendCustomer, { customerId: "ada", reason: "overdue" })
} catch (error) {
  if (isUnavailable(error)) console.log("retry later:", error.message)
  else throw error
}

// Route all commands for one customer to the same handler instance
await send(kronosDbBus, SuspendCustomer, { customerId: "ada", reason: "overdue" }, {
  processingInstructions: { routingKey: "ada", priority: 1, timeoutMs: 5_000 },
})
