import { z } from "zod"
import { ns } from "../events"

export const RegisterCustomer = ns.command("RegisterCustomer", {
  payload: z.object({ customerId: z.string().min(1), name: z.string().min(1), maxRentals: z.number().int() }),
  result: z.object({ ok: z.literal(true) }),
})
