import type { RunningProcessor } from "@kronos-ts/core"
import { replayInventory } from "./replay.js"

const route = /^\/admin\/processors\/([^/]+)(\/replay)?$/

export function adminRoutes(processors: ReadonlyMap<string, RunningProcessor>) {
  return async (request: Request): Promise<Response> => {
    const match = route.exec(new URL(request.url).pathname)
    const processor = match?.[1] === undefined ? undefined : processors.get(match[1])
    if (processor === undefined) return Response.json({ error: "no such processor" }, { status: 404 })

    if (match?.[2] === undefined) {
      const { running, position, caughtUp, replaying } = processor.status()
      return Response.json({ running, position: String(position), caughtUp, replaying })
    }

    if (request.method !== "POST") return new Response(null, { status: 405 })
    if (processor.name !== "inventory-view") return Response.json({ error: "only inventory-view can be replayed" }, { status: 400 })
    try {
      await replayInventory(processor)
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 409 })
    }
    return Response.json({ replaying: processor.replaying }, { status: 202 })
  }
}
