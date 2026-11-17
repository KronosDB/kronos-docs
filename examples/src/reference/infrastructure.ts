import {
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  jsonSerializer,
  localCommandBus,
  localQueryBus,
  unitOfWork,
} from "@kronos-ts/core"
import {
  kronosDbCommandBus,
  kronosDbConnection,
  kronosDbEventStore,
  kronosDbQueryBus,
} from "@kronos-ts/kronosdb"
import {
  postgresEventStore,
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { rabbitMqCommandBus, rabbitMqConnection, rabbitMqQueryBus } from "@kronos-ts/rabbitmq"

// Everything in memory: one process, nothing survives a restart.
const memoryStore = inMemoryEventStore()
const memoryTokens = inMemoryTokenStore()
export const memoryProcessor = eventProcessor("inventory-view", memoryStore, memoryTokens, unitOfWork)

// Postgres for the log and the tokens, RabbitMQ for the buses.
const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
await pg.start()

const uow = postgresUnitOfWork(unitOfWork, pg)
export const eventStore = postgresEventStore(pg)
export const tokenStore = postgresTokenStore(pg)

const rabbit = await rabbitMqConnection("amqp://localhost", {
  serviceName: "toolstore",
  instanceId: "counter-1",
})

// A remote bus wraps the local bus it falls back to and delivers to.
export const commandBus = rabbitMqCommandBus(localCommandBus(uow), rabbit)
export const queryBus = rabbitMqQueryBus(localQueryBus(unitOfWork), rabbit)

// KronosDB for the log and both buses, Postgres for the tokens and the batch transaction.
const kdb = await kronosDbConnection({
  componentName: "toolstore",
  context: "toolstore",
  serializer: jsonSerializer(),
})

export const kronosDbStore = kronosDbEventStore(kdb, "toolstore")
export const kronosDbCommands = kronosDbCommandBus(localCommandBus(uow), kdb, "toolstore")
export const kronosDbQueries = kronosDbQueryBus(localQueryBus(unitOfWork), kdb, "toolstore")
export const projection = eventProcessor("inventory-view", kronosDbStore, tokenStore, uow)
