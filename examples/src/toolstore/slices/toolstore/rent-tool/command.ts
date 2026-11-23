import { z } from "zod"
import { ns } from "../events"

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string().min(1), customerId: z.string().min(1) }),
  result: z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), rejection: z.literal("TOOL_UNAVAILABLE"), toolId: z.string() }),
    z.object({ ok: z.literal(false), rejection: z.literal("CUSTOMER_UNKNOWN"), customerId: z.string() }),
    z.object({
      ok: z.literal(false),
      rejection: z.literal("OVER_LIMIT"),
      customerId: z.string(),
      maxRentals: z.number().int(),
    }),
  ]),
})
