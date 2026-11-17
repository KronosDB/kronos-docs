import {
  commandHandler,
  kronos,
  localCommandBus,
  localFirstCommandBus,
  localFirstQueryBus,
  localQueryBus,
  query,
  queryHandler,
  send,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { rabbitMqCommandBus, rabbitMqConnection, rabbitMqQueryBus } from "@kronos-ts/rabbitmq"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const SuspendCustomer = ns.command("SuspendCustomer", {
  payload: z.object({ customerId: z.string(), reason: z.string() }),
})

export const GetCustomerRentals = ns.query("GetCustomerRentals", {
  payload: z.object({ customerId: z.string() }),
  result: z.array(z.string()),
})

export const suspendCustomer = commandHandler(SuspendCustomer, async () => {})

export const getCustomerRentals = queryHandler(GetCustomerRentals, () => [])

export async function run(instanceId: string) {
  const rabbit = await rabbitMqConnection("amqp://rabbitmq.internal:5672", {
    serviceName: "toolstore-counter",
    instanceId,
  })

  const local = localCommandBus(unitOfWork)
  const localQueries = localQueryBus(unitOfWork)
  const commandBus = localFirstCommandBus(rabbitMqCommandBus(local, rabbit), local)
  const queryBus = localFirstQueryBus(rabbitMqQueryBus(localQueries, rabbit), localQueries)

  const app = kronos({
    commandHandlers: [{ ...suspendCustomer, commandBus, queryBus }],
    queryHandlers: [{ ...getCustomerRentals, queryBus }],
  })

  await rabbit.start()

  await send(commandBus, SuspendCustomer, { customerId: "ada", reason: "overdue" })
  const toolIds = await query(queryBus, GetCustomerRentals, { customerId: "ada" })

  await app.stop()
  await rabbit.close()
  return toolIds
}
