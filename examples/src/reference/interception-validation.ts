import {
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  query,
  queryHandler,
  send,
  unitOfWork,
  validate,
  validatingHandler,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string().min(1), name: z.string(), maxRentals: z.number().int().default(2) }),
})

export const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number().int().min(1) }),
  tags: { customerId: (payload) => payload.customerId },
})

// validate returns the parsed payload, with defaults applied
const body: unknown = { customerId: "ada", name: "Ada" }
const parsed = await validate(RegisterCustomer, body)
console.log("parsed", JSON.stringify(parsed))

try {
  await validate(RegisterCustomer, { customerId: "", name: "Ada" })
} catch (error) {
  console.log("rejected", (error as Error).message)
}

export const registerCustomer = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  ctx.append(CustomerRegistered, { ...payload, maxRentals: payload.maxRentals - 2 })
})

const commandBus = localCommandBus(unitOfWork)
const app = kronos({
  commandHandlers: [
    {
      ...registerCustomer,
      handler: validatingHandler(registerCustomer.handler, registerCustomer.descriptor),
      eventStore: inMemoryEventStore(),
      commandBus,
      queryBus: localQueryBus(unitOfWork),
    },
  ],
})

// The payload is wrong at runtime, though the cast says otherwise
try {
  await send(commandBus, RegisterCustomer, { customerId: 7 } as never)
} catch (error) {
  console.log((error as Error).message)
}

// The handler appends an event whose payload breaks its own schema
try {
  await send(commandBus, RegisterCustomer, { customerId: "grace", name: "Grace", maxRentals: 2 })
} catch (error) {
  console.log((error as Error).message)
}

await app.stop()

// A query's answer is checked against its result schema
export const GetCustomer = ns.query("GetCustomer", {
  payload: z.object({ customerId: z.string() }),
  result: z.object({ customerId: z.string(), maxRentals: z.number().int() }),
})

const customerRows = new Map<string, Record<string, unknown>>([
  ["ada", { customerId: "ada", maxRentals: 2, internalNote: "verified" }],
  ["linus", { customerId: "linus", maxRentals: "2" }],
])

export const getCustomer = queryHandler(GetCustomer, ({ payload }) =>
  customerRows.get(payload.customerId) as { customerId: string; maxRentals: number },
)

const queryBus = localQueryBus(unitOfWork)
const queries = kronos({
  queryHandlers: [{ ...getCustomer, handler: validatingHandler(getCustomer.handler, getCustomer.descriptor), queryBus }],
})

console.log(JSON.stringify(await query(queryBus, GetCustomer, { customerId: "ada" })))

try {
  await query(queryBus, GetCustomer, { customerId: "linus" })
} catch (error) {
  console.log((error as Error).message)
}

await queries.stop()
