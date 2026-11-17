import { commandHandler, state } from "@kronos-ts/core"
import { z } from "zod"
import { CustomerRegistered, RegisterCustomer } from "./messages"

export const Customer = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ registered: false }),
    [CustomerRegistered, (customer) => ({ ...customer, registered: true })],
  ],
})

export const registerCustomer = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  const customer = await ctx.load(Customer, { customerId: payload.customerId })
  if (customer.registered) throw new Error(`customer ${payload.customerId} already exists`)
  ctx.append(CustomerRegistered, payload)
})
