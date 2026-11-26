import { z } from "zod"
import { ns } from "../../../toolstore/slices/toolstore/events"

export const SendReceipt = ns.command("SendReceipt", {
  payload: z.object({ toolId: z.string().min(1), customerId: z.string().min(1) }),
  result: z.object({ ok: z.literal(true) }),
})
