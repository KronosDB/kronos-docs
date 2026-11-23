import { state } from "@kronos-ts/core"
import { z } from "zod"
import { CustomerRegistered } from "../events"

/** Whether the customer is already registered. */
export const Customer = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    (): { registered: boolean } => ({ registered: false }),
    [CustomerRegistered, () => ({ registered: true })],
  ],
})
