import { state } from "@kronos-ts/core"
import { z } from "zod"
import { ToolAdded } from "../events"

/** Whether the tool is already in the store. */
export const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    (): { added: boolean } => ({ added: false }),
    [ToolAdded, () => ({ added: true })],
  ],
})
