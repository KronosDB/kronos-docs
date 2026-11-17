import { jsonSerializer } from "@kronos-ts/core"
import { kronosDbConnection, kronosDbTail } from "@kronos-ts/kronosdb"

export async function checkConnection() {
  const kdb = await kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    host: "localhost",
    port: 50051,
    context: "toolstore",
  })

  const firstPosition = await kronosDbTail(kdb, "toolstore")
  await kdb.close()
  return firstPosition
}
