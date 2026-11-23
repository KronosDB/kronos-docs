/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import type { RunningProcessor } from "@kronos-ts/core"
import { admin } from "./admin"

export function serveAdmin(processors: ReadonlyMap<string, RunningProcessor>) {
  const routes = admin(processors)
  return Bun.serve({
    port: 0,
    routes: {
      "/admin/processors/:name": { GET: (request) => routes.status(request.params.name) },
      "/admin/processors/:name/replay": { POST: (request) => routes.replay(request.params.name) },
    },
  })
}
