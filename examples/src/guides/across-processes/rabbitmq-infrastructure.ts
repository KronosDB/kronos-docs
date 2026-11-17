import {
  localCommandBus,
  localFirstCommandBus,
  localFirstQueryBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import { postgresEventStore, postgresPool, postgresUnitOfWork } from "@kronos-ts/postgres"
import { rabbitMqCommandBus, rabbitMqConnection, rabbitMqQueryBus } from "@kronos-ts/rabbitmq"
import type { Infrastructure } from "./infrastructure.js"

export async function connect(serviceName: string): Promise<Infrastructure> {
  const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
  await pg.start()

  const rabbit = await rabbitMqConnection(process.env.RABBITMQ_URL ?? "amqp://localhost", {
    serviceName,
    instanceId: crypto.randomUUID(),
  })

  const localCommands = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
  const localQueries = localQueryBus(unitOfWork)

  return {
    eventStore: postgresEventStore(pg),
    commandBus: localFirstCommandBus(rabbitMqCommandBus(localCommands, rabbit), localCommands),
    queryBus: localFirstQueryBus(rabbitMqQueryBus(localQueries, rabbit), localQueries),
    start: () => rabbit.start(),
    async close() {
      await rabbit.close()
      await pg.close()
    },
  }
}
