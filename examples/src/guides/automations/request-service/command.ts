import { z } from "zod"
import { ns } from "../../../toolstore/slices/toolstore/events"

export const RequestService = ns.command("RequestService", {
  payload: z.object({ toolId: z.string().min(1) }),
  result: z.object({ ok: z.literal(true) }),
})
