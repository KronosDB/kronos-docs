import type { RunningProcessor } from "@kronos-ts/core"
import { replayInventory } from "../../toolstore/slices/toolstore/inventory/replay"

/** The processors that can be replayed, each with the function that clears what it wrote. */
const replays: Record<string, (processor: RunningProcessor) => Promise<void>> = {
  "inventory-view": replayInventory,
}

export function admin(processors: ReadonlyMap<string, RunningProcessor>) {
  return {
    status(name: string): Response {
      const processor = processors.get(name)
      if (processor === undefined) return Response.json({ error: `no processor ${name}` }, { status: 404 })
      const { running, position, caughtUp, replaying } = processor.status()
      return Response.json({ running, position: String(position), caughtUp, replaying })
    },

    async replay(name: string): Promise<Response> {
      const processor = processors.get(name)
      const replay = replays[name]
      if (processor === undefined || replay === undefined) {
        return Response.json({ error: `${name} cannot be replayed` }, { status: 404 })
      }
      try {
        await replay(processor)
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 409 })
      }
      return Response.json({ replaying: processor.replaying }, { status: 202 })
    },
  }
}
