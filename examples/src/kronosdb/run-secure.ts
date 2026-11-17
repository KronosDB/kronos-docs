import { jsonSerializer } from "@kronos-ts/core"
import { kronosDbConnection } from "@kronos-ts/kronosdb"

export async function connectWithToken(token: string) {
  return kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    host: "kronosdb.internal",
    port: 50051,
    context: "toolstore",
    token,
  })
}

export async function connectWithTls() {
  return kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    host: "kronosdb.internal",
    port: 50051,
    context: "toolstore",
    ssl: {
      enabled: true,
      certFile: "/etc/kronosdb/ca.pem",
      clientCertFile: "/etc/kronosdb/client.pem",
      clientKeyFile: "/etc/kronosdb/client-key.pem",
    },
  })
}

export async function connectToCluster(token: string) {
  return kronosDbConnection({
    componentName: "toolstore-counter",
    serializer: jsonSerializer(),
    servers: ["node1.internal:50051", "node2.internal:50051", "node3.internal:50051"],
    context: "toolstore",
    token,
  })
}
