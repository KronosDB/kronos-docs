import { commandHandler, state, withNamespace } from "@kronos-ts/core"
import { z } from "zod"
import { slice } from "./slice"

const ns = withNamespace("toolstore")

export const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
})

export const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  tags: { customerId: (payload) => payload.customerId },
})

const Customer = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ registered: false }),
    [CustomerRegistered, (customer) => ({ ...customer, registered: true })],
  ],
})

const registerCustomer = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  const customer = await ctx.load(Customer, { customerId: payload.customerId })
  if (customer.registered) throw new Error(`customer ${payload.customerId} already exists`)
  ctx.append(CustomerRegistered, payload)
})

export const registerCustomerSlice = slice({ commandHandlers: [registerCustomer] })
