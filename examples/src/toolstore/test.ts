/// <reference types="../../../../kronos-ts/node_modules/bun-types" />
import { afterAll } from "bun:test"
import {
  type App,
  type CommandHandler,
  deadLettering,
  type EventHandler,
  type EventProcessor,
  eventProcessor,
  inMemoryDeadLetterQueue,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  type QueryHandler,
  type Sequence,
  type SequencedDeadLetterQueue,
  type UnitOfWork,
  unitOfWork,
  validatingHandler,
} from "@kronos-ts/core"
import {
  postgresDeadLetterQueue,
  postgresHandler,
  postgresPool,
  postgresTokenStore,
  postgresUnitOfWork,
} from "@kronos-ts/postgres"
import { recordingCommandBus, recordingEventStore } from "@kronos-ts/test"
import { pipe } from "./pipe"
import { migrate } from "./migrations"

/**
 * What a test file builds its app from. `app(handlers)` takes one set of the three lists, a slice's or a context's,
 * and composes them exactly as `main.ts` composes the contexts' lists, over an in-memory log and a recorded command bus, so `fixture()` can observe them, and stops
 * the app after the file's last test. `{ db: true }` gives the app a fresh Postgres database, dropped afterwards, for
 * slices that write tables; without it the app is given a pool that is never opened.
 */
export async function testInfrastructure(options?: { db: true }) {
  const database = options?.db ? await freshDatabase() : undefined
  const pg = database?.pg ?? postgresPool(serverUrl)

  const eventStore = recordingEventStore(inMemoryEventStore())
  const commandBus = recordingCommandBus(localCommandBus(unitOfWork))
  const queryBus = localQueryBus(unitOfWork)

  const started: App[] = []
  afterAll(async () => {
    for (const app of started) await app.stop()
    await database?.drop()
  })

  const app = (handlers: {
    commandHandlers: CommandHandler<any, any, any>[]
    queryHandlers: QueryHandler<any, any, any>[]
    eventHandlers: (EventHandler<any, any> & { processor: EventProcessor })[]
  }) => {
    const running = kronos({
      commandHandlers: handlers.commandHandlers.map((handler) => ({
        ...handler,
        handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
        eventStore,
        commandBus,
        queryBus,
      })),
      queryHandlers: handlers.queryHandlers.map((handler) => ({
        ...handler,
        handler: pipe(
          handler.handler,
          (next) => postgresHandler(next, pg),
          (next) => validatingHandler(next, handler.descriptor),
        ),
        queryBus,
      })),
      eventHandlers: handlers.eventHandlers.map((handler) => ({
        ...handler,
        handler: pipe(
          handler.handler,
          (next) => postgresHandler(next, pg),
          (next) => validatingHandler(next, handler.descriptor),
        ),
        commandBus,
        queryBus,
        // Built over this recorded log by the `eventProcessor` below, so fixture() sees it as recorded.
        processor: handler.processor as EventProcessor<UnitOfWork, typeof eventStore>,
      })),
    })
    started.push(running)
    return running
  }

  const deadLetterQueue: SequencedDeadLetterQueue = database ? postgresDeadLetterQueue(pg) : inMemoryDeadLetterQueue()

  return {
    app,
    eventProcessor: (name: string) =>
      database
        ? eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))
        : eventProcessor(name, eventStore, inMemoryTokenStore(), unitOfWork),
    deadLettering: (processor: EventProcessor, sequence: Sequence) => deadLettering(processor, deadLetterQueue, sequence),
  }
}

const serverUrl = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres"

/** A database of its own for one test file, with the kronos tables and every migration. */
async function freshDatabase() {
  const name = `test_${crypto.randomUUID().replaceAll("-", "")}`
  const admin = postgresPool(serverUrl, { bootstrap: false })
  await admin.start()
  await admin.query(`CREATE DATABASE ${name}`)

  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  const pg = postgresPool(url.toString())
  await pg.start()
  await migrate(pg)

  return {
    pg,
    async drop() {
      await pg.close()
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await admin.close()
    },
  }
}
