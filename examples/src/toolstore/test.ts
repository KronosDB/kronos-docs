/// <reference types="../../../../kronos-ts/node_modules/bun-types" />
import { afterAll } from "bun:test"
import {
  type App,
  type CommandHandler,
  type EventHandler,
  type EventProcessor,
  eventProcessor,
  inMemoryEventStore,
  inMemoryTokenStore,
  kronos,
  localCommandBus,
  localQueryBus,
  type QueryHandler,
  type UnitOfWork,
  unitOfWork,
  validatingHandler,
} from "@kronos-ts/core"
import { postgresHandler, postgresPool, postgresTokenStore, postgresUnitOfWork } from "@kronos-ts/postgres"
import { recordingCommandBus, recordingEventStore } from "@kronos-ts/test"
import { pipe } from "./pipe"
import { migrate } from "./migrations"

/**
 * What a test file builds its app from. `app(...slices)` composes the slices the test passes exactly as `main.ts`
 * composes every slice, over an in-memory log and a recorded command bus, so `fixture()` can observe them, and stops
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

  const app = (
    ...slices: Array<{
      commandHandlers: CommandHandler<any, any, any>[]
      queryHandlers: QueryHandler<any, any, any>[]
      eventHandlers: (EventHandler<any, any> & { processor: EventProcessor })[]
    }>
  ) => {
    const running = kronos({
      commandHandlers: slices
        .flatMap((slice) => slice.commandHandlers)
        .map((handler) => ({
          ...handler,
          handler: pipe(handler.handler, (next) => validatingHandler(next, handler.descriptor)),
          eventStore,
          commandBus,
          queryBus,
        })),
      queryHandlers: slices
        .flatMap((slice) => slice.queryHandlers)
        .map((handler) => ({
          ...handler,
          handler: pipe(
            handler.handler,
            (next) => postgresHandler(next, pg),
            (next) => validatingHandler(next, handler.descriptor),
          ),
          queryBus,
        })),
      eventHandlers: slices
        .flatMap((slice) => slice.eventHandlers)
        .map((handler) => ({
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

  return {
    app,
    eventProcessor: (name: string) =>
      database
        ? eventProcessor(name, eventStore, postgresTokenStore(pg), postgresUnitOfWork(unitOfWork, pg))
        : eventProcessor(name, eventStore, inMemoryTokenStore(), unitOfWork),
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
