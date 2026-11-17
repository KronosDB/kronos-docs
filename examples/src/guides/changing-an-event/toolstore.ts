import { afterEvents, commandHandler, eventHandler, queryHandler, snapshot, state } from "@kronos-ts/core"
import { z } from "zod"
import { AddTool, GetInventory, ToolAdded } from "./descriptors.js"

export const Tool = snapshot(
  state({
    id: { toolId: z.string() },
    tags: (id) => ({ toolId: id.toolId }),
    evolve: [
      () => ({ exists: false, category: "" }),
      [ToolAdded, (tool, { payload }) => ({ ...tool, exists: true, category: payload.category })],
    ],
  }),
  "tool-v2",
  afterEvents(100),
)

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) throw new Error(`tool ${payload.toolId} already exists`)
  ctx.append(ToolAdded, payload)
})

const inventory = new Map<string, { toolId: string; name: string; category: string }>()

export const recordAddedTool = eventHandler(ToolAdded, ({ payload }) => {
  inventory.set(payload.toolId, { toolId: payload.toolId, name: payload.name, category: payload.category })
})

export const getInventory = queryHandler(GetInventory, () => [...inventory.values()])
