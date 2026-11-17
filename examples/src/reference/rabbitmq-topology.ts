import { localCommandBus, localQueryBus, unitOfWork } from "@kronos-ts/core"
import { rabbitMqCommandBus, rabbitMqConnection, rabbitMqQueryBus, rabbitMqTopologyNames } from "@kronos-ts/rabbitmq"

export async function connectWithOwnNames(instanceId: string) {
  const rabbit = await rabbitMqConnection("amqp://rabbitmq.internal:5672", {
    serviceName: "toolstore-counter",
    instanceId,
    topology: {
      prefix: "toolstore",
    },
    retry: {
      deadLetter: true,
      deadLetterExchange: "toolstore.dead",
    },
    limits: { maxConcurrentHandlers: 64, maxPendingRequests: 512 },
    shutdownTimeoutMs: 10_000,
  })

  const commandBus = rabbitMqCommandBus(localCommandBus(unitOfWork), rabbit, { timeoutMs: 10_000 })
  const queryBus = rabbitMqQueryBus(localQueryBus(unitOfWork), rabbit, { timeoutMs: 5_000 })
  return { rabbit, commandBus, queryBus }
}

export function namesFor(instanceId: string) {
  const names = rabbitMqTopologyNames({ serviceName: "toolstore-counter", instanceId })
  return {
    exchange: names.commandsExchange,
    routingKey: names.commandRoutingKey("toolstore.SuspendCustomer"),
    queue: names.commandQueue("toolstore.SuspendCustomer"),
    replies: names.commandReplyQueue(),
  }
}
