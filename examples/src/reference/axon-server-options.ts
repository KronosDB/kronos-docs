import { jsonSerializer, localCommandBus, localFirstCommandBus, localFirstQueryBus, localQueryBus, unitOfWork } from "@kronos-ts/core"
import {
  axonServerCommandBus,
  axonServerConnection,
  axonServerQueryBus,
  messageSizeValidator,
} from "@kronos-ts/axon-server"

export async function connectToCluster(token: string) {
  return axonServerConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    servers: ["axonserver-1.internal:8124", "axonserver-2.internal:8124"],
    context: "toolstore",
    token,
    ssl: {
      enabled: true,
      certFile: "/etc/toolstore/ca.pem",
      clientCertFile: "/etc/toolstore/client.pem",
      clientKeyFile: "/etc/toolstore/client.key",
    },
    keepAliveTimeMs: 30_000,
    keepAliveTimeoutMs: 10_000,
    readTimeoutMs: 15_000,
    reconnectIntervalMs: 1_000,
    maxReconnectAttempts: 20,
    busSubscriptionAckDelayMs: 1_000,
    shutdownTimeoutMs: 10_000,
    platformService: {
      heartbeatIntervalMs: 2_500,
      heartbeatTimeoutMs: 7_500,
    },
    resilience: {
      maxAttempts: 10,
      initialDelayMs: 200,
    },
  })
}

export async function tuneBuses(token: string) {
  const axon = await connectToCluster(token)
  const local = localCommandBus(unitOfWork)
  const localQueries = localQueryBus(unitOfWork)

  const commandBus = localFirstCommandBus(
    axonServerCommandBus(local, axon, {
      timeoutMs: 10_000,
      loadFactor: 50,
      flowControl: { permits: 1_000, refillThreshold: 250 },
      limits: { maxConcurrentHandlers: 64, maxPendingRequests: 512 },
    }),
    local,
  )
  const queryBus = localFirstQueryBus(
    axonServerQueryBus(localQueries, axon, { timeoutMs: 5_000 }),
    localQueries,
  )
  return { commandBus, queryBus }
}

export function checkSize(payload: Uint8Array) {
  const validator = messageSizeValidator({ maxMessageSize: 2 * 1024 * 1024, warningThreshold: 0.5 })
  validator.validate(payload, "RentTool")
  return validator.maxSize
}
