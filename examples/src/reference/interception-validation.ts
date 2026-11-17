import {
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
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
console.log(parsed)

try {
  await validate(RegisterCustomer, { customerId: "", name: "Ada" })
} catch (error) {
  console.log((error as Error).message)
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
