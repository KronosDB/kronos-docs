import { z } from "zod"
import { ns } from "../events"

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string().min(1), model: z.string().min(1), name: z.string().min(1) }),
  result: z.object({ ok: z.literal(true) }),
})
