import {
  commandHandler,
  inMemoryEventStore,
  kronos,
  localCommandBus,
  localQueryBus,
  send,
  state,
  unitOfWork,
  upcast,
  upcastingEventStore,
  withNamespace,
  type EventMessage,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const payload = z.object({ toolId: z.string(), customerId: z.string() })
const tags = { toolId: (event: z.infer<typeof payload>) => event.toolId }

// The name in the log, declared so the upcast can start from it.
export const RentalOverdue = ns.event("RentalOverdue", { version: "1.0", payload, tags })

// The name the code uses today.
export const RentalLapsed = ns.event("RentalLapsed", { version: "2.0", payload, tags })

export const CheckLapse = ns.command("CheckLapse", { payload: z.object({ toolId: z.string() }) })

const lapsedRentals = upcast(RentalOverdue, RentalLapsed, (payload) => payload)

// The state folds the name the code uses. The store asks the log for the old
// name too, and the upcast turns those events into RentalLapsed.
export const Lapse = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ lapsed: false }),
    [RentalLapsed, (lapse) => ({ ...lapse, lapsed: true })],
  ],
})

export const checkLapse = commandHandler(CheckLapse, async ({ payload }, ctx) => {
  const lapse = await ctx.load(Lapse, { toolId: payload.toolId })
  console.log(`lapsed: ${lapse.lapsed}`)
})

const log = inMemoryEventStore()
const eventStore = upcastingEventStore(log, [lapsedRentals])

const stored: EventMessage = {
  kind: "event",
  identifier: "e-1",
  name: RentalOverdue.name,
  version: "1.0",
  payload: { toolId: "t-1", customerId: "ada" },
  metadata: {},
  timestamp: 1_700_000_000_000,
}
await log.append([{ event: stored, tags: [{ key: "toolId", value: "t-1" }] }])

const commandBus = localCommandBus(unitOfWork)
const queryBus = localQueryBus(unitOfWork)
const app = kronos({
  commandHandlers: [{ ...checkLapse, eventStore, commandBus, queryBus }],
})

await send(commandBus, CheckLapse, { toolId: "t-1" })
await app.stop()
