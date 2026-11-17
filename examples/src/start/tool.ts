import { commandHandler, state } from "@kronos-ts/core"
import { z } from "zod"
import { AddTool, ToolAdded } from "./messages"

export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

export const addTool = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.exists) throw new Error(`tool ${payload.toolId} already exists`)
  ctx.append(ToolAdded, payload)
})
