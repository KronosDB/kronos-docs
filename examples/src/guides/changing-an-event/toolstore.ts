import { afterEvents, commandHandler, eventHandler, queryHandler, snapshot, state } from "@kronos-ts/core"
import { z } from "zod"
import { ToolAdded, ns } from "./events"

export const AddTool = ns.command("AddTool", {
  payload: z.object({ toolId: z.string().min(1), model: z.string().min(1), name: z.string().min(1), category: z.string().min(1) }),
  result: z.object({ ok: z.literal(true) }),
})

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), category: z.string() })),
})

export const Tool = snapshot(
  state({
    id: { toolId: z.string() },
    tags: (id) => ({ toolId: id.toolId }),
    evolve: [
      (): { added: false } | { added: true; category: string } => ({ added: false }),
      [ToolAdded, (_tool, { payload }) => ({ added: true, category: payload.category })],
    ],
  }),
  "tool-v2",
  afterEvents(100),
)

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.added) return { ok: true }
  ctx.append(ToolAdded, payload)
  return { ok: true }
})

const inventory = new Map<string, { toolId: string; name: string; category: string }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, category: payload.category })
})

export const getInventory = queryHandler(GetInventory, () => [...inventory.values()])
