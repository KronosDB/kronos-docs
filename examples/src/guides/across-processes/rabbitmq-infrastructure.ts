import { eventProcessor, localCommandBus, localFirstCommandBus, localFirstQueryBus, localQueryBus, unitOfWork } from "@kronos-ts/core"
import {
  postgresEventStore,
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { rabbitMqCommandBus, rabbitMqConnection, rabbitMqQueryBus } from "@kronos-ts/rabbitmq"
import { migrate } from "../../toolstore/migrations"

export async function connect(serviceName: string) {
  const pg = postgresPool(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/toolstore")
  await pg.start()
  await migrate(pg)

  const rabbit = await rabbitMqConnection(process.env.RABBITMQ_URL ?? "amqp://localhost", {
    serviceName,
    instanceId: crypto.randomUUID(),
  })

  const localCommands = localCommandBus(postgresUnitOfWork(unitOfWork, pg))
  const localQueries = localQueryBus(unitOfWork)

  const eventStore = postgresEventStore(pg)

  return {
    eventStore,
    commandBus: localFirstCommandBus(rabbitMqCommandBus(localCommands, rabbit), localCommands),
    queryBus: localFirstQueryBus(rabbitMqQueryBus(localQueries, rabbit), localQueries),
    eventProcessor: (name: string) =>
      eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg)),
    pg,
    start: () => rabbit.start(),
    async close() {
      await rabbit.close()
      await pg.close()
    },
  }
}
