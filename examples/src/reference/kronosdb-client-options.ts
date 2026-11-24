import { jsonSerializer, localCommandBus, localFirstCommandBus, localFirstQueryBus, localQueryBus, unitOfWork } from "@kronos-ts/core"
import { kronosDbCommandBus, kronosDbConnection, kronosDbQueryBus } from "@kronos-ts/kronosdb"

export async function connectToCluster(token: string) {
  const kdb = await kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    servers: ["kronosdb-1.internal:50051", "kronosdb-2.internal:50051", "kronosdb-3.internal:50051"],
    context: "toolstore",
    token,
    ssl: {
      enabled: true,
      certFile: "/etc/toolstore/ca.pem",
      clientCertFile: "/etc/toolstore/client.pem",
      clientKeyFile: "/etc/toolstore/client.key",
    },
    connectTimeoutMs: 5_000,
    reconnectIntervalMs: 1_000,
    maxReconnectAttempts: 20,
    window: 4 * 1024 * 1024,
    appendRetryMs: 60_000,
    startTimeoutMs: 15_000,
    shutdownTimeoutMs: 10_000,
    platformService: {
      heartbeatIntervalMs: 5_000,
      heartbeatTimeoutMs: 30_000,
    },
    resilience: {
      maxAttempts: 10,
      initialDelayMs: 200,
      maxDelayMs: 10_000,
    },
  })
  return kdb
}

export async function tuneBuses(token: string) {
  const kdb = await connectToCluster(token)
  const local = localCommandBus(unitOfWork)
  const localQueries = localQueryBus(unitOfWork)

  const commandBus = localFirstCommandBus(
    kronosDbCommandBus(local, kdb, "toolstore", {
      timeoutMs: 10_000,
      loadFactor: 50,
      flowControl: { permits: 1_000, refillThreshold: 250 },
      limits: { maxConcurrentHandlers: 64, maxPendingRequests: 512 },
    }),
    local,
  )
  const queryBus = localFirstQueryBus(
    kronosDbQueryBus(localQueries, kdb, "toolstore", { timeoutMs: 5_000 }),
    localQueries,
  )
  return { commandBus, queryBus }
}
