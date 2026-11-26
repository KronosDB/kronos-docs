import { commandHandler } from "@kronos-ts/core"
import { CustomerRegistered } from "../events"
import { RegisterCustomer } from "./command"
import { Customer } from "./state"

export const handle = commandHandler(RegisterCustomer, async ({ payload }, ctx) => {
  const customer = await ctx.load(Customer, { customerId: payload.customerId })
  if (customer.registered) return { ok: true }
  ctx.append(CustomerRegistered, payload)
  return { ok: true }
})
