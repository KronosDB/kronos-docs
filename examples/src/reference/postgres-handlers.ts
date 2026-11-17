import {
  commandHandler,
  eventHandler,
  kronos,
  localCommandBus,
  localQueryBus,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type EventHandlerContext,
} from "@kronos-ts/core"
import {
  activePostgresTransaction,
  postgresEventStore,
  postgresHandler,
  postgresPool,
  postgresTransaction,
  postgresUnitOfWork,
  type PostgresCapability,
} from "@kronos-ts/postgres"
import type { PoolClient } from "pg"
import { z } from "zod"

const ns = withNamespace("toolstore")

const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
})

const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  tags: { customerId: (payload) => payload.customerId },
})

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

const pg = postgresPool("postgresql://toolstore:secret@localhost:5432/toolstore")
const uow = postgresUnitOfWork(unitOfWork, pg)
const eventStore = postgresEventStore(pg)

// In a command handler ctx.sql() is the pool: the write commits as it runs.
export const registerCustomer = commandHandler(
  RegisterCustomer,
  async ({ payload }, ctx: CommandHandlerContext & PostgresCapability) => {
    await ctx.sql().query(
      `INSERT INTO customer_names (customer_id, name) VALUES ($1, $2)
       ON CONFLICT (customer_id) DO UPDATE SET name = EXCLUDED.name`,
      [payload.customerId, payload.name],
    )
    ctx.append(CustomerRegistered, payload)
  },
)

// In an event handler ctx.sql() is the batch's transaction: the write commits with the token.
export const markToolRented = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    await ctx.sql().query("UPDATE inventory SET available = false WHERE tool_id = $1", [payload.toolId])
  },
)

// Wrap the handler function, then spread the entry.
const commandBus = localCommandBus(uow)
const queryBus = localQueryBus(unitOfWork)

export const app = kronos({
  commandHandlers: [
    {
      ...registerCustomer,
      handler: postgresHandler(registerCustomer.handler, pg),
      eventStore,
      commandBus,
      queryBus,
    },
  ],
})

// A writer that needs the transaction whether or not anything has opened it yet.
export const countRental = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext) => {
    const tx = await postgresTransaction(ctx.unitOfWork)
    await tx.query("UPDATE customer_rentals SET rentals = rentals + 1 WHERE customer_id = $1", [
      payload.customerId,
    ])
  },
)

// A read that must not open a transaction: join one if it is there, else use the pool.
export async function rentalsOf(customerId: string, uowOfCaller: ReturnType<typeof uow>) {
  const reader = activePostgresTransaction(uowOfCaller) ?? pg
  return reader.query("SELECT tool_id FROM rentals WHERE customer_id = $1", [customerId])
}

// A query builder binds to the driver connection behind the same handle.
export const bindToConnection = eventHandler(
  ToolRented,
  async ({ payload }, ctx: EventHandlerContext & PostgresCapability) => {
    const connection = ctx.sql().unwrap<PoolClient>()
    await connection.query("DELETE FROM waiting_list WHERE tool_id = $1", [payload.toolId])
  },
)
