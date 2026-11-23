import { commandHandler } from "@kronos-ts/core"
import { ToolAdded } from "../events"
import { AddTool } from "./command"
import { Tool } from "./state"

/** Adding a tool that is already in the store is a retry: it succeeds and appends nothing. */
export const handle = commandHandler(AddTool, async ({ payload }, ctx) => {
  const tool = await ctx.load(Tool, { toolId: payload.toolId })
  if (tool.added) return { ok: true }
  ctx.append(ToolAdded, payload)
  return { ok: true }
})
