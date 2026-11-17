import {
  commandHandler,
  correlatingHandler,
  correlation,
  inMemoryEventStore,
  interceptingCommandBus,
  interceptingQueryBus,
  kronos,
  localCommandBus,
  localQueryBus,
  loggingHandler,
  send,
  unitOfWork,
  withNamespace,
  type CommandHandlerContext,
  type LogCapability,
} from "@kronos-ts/core"
import {
  otlpCommandBus,
  otlpExporter,
  otlpHandler,
  otlpLogger,
  otlpQueryBus,
  trace,
  traceparentOf,
  type MetricsCapability,
  type TraceCapability,
} from "@kronos-ts/otlp"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const RentTool = ns.command("RentTool", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
})

export const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: { toolId: (payload) => payload.toolId, customerId: (payload) => payload.customerId },
})

// One exporter per process, shared by every wrapper.
const exporter = otlpExporter({
  endpoint: "http://localhost:4318",
  serviceName: "toolstore",
  resource: { "service.version": "1.4.0", "deployment.environment.name": "production" },
  sample: 0.25,
})
const logger = otlpLogger(exporter, { level: "info" })

export const rentTool = commandHandler(
  RentTool,
  async (
    { payload },
    ctx: CommandHandlerContext & LogCapability & TraceCapability & MetricsCapability,
  ) => {
    ctx.log.info("renting a tool", { toolId: payload.toolId })
    ctx.metrics.count("rentals.started", { customer_type: "member" })
    await ctx.trace.run("check-stock", async () => {})
    ctx.append(ToolRented, payload)
  },
)

const eventStore = inMemoryEventStore()
const commandBus = otlpCommandBus(interceptingCommandBus(localCommandBus(unitOfWork), correlation), exporter)
const queryBus = otlpQueryBus(interceptingQueryBus(localQueryBus(unitOfWork), correlation), exporter)

// otlpHandler goes outermost: it stamps the traceparent that the others read.
const traced = otlpHandler(loggingHandler(correlatingHandler(rentTool.handler), logger), exporter)

const app = kronos({
  commandHandlers: [{ ...rentTool, handler: traced, eventStore, commandBus, queryBus }],
})

// An HTTP edge joins the caller's trace, or starts one.
export async function handleRequest(headers: Record<string, string>, body: { toolId: string; customerId: string }) {
  const incoming = trace(exporter, traceparentOf(headers))
  return incoming.run("POST /rentals", (span) =>
    send(commandBus, RentTool, body, { traceparent: span.traceparent! }),
  )
}

// On shutdown: stop the app first, then close the exporter last.
await app.stop()
await exporter.close()
