import { isConflict, send } from "@kronos-ts/core"
import { AddTool, RegisterCustomer, RentTool, commandBus } from "./state.js"

await send(commandBus, AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
await send(commandBus, RegisterCustomer, { customerId: "ada", name: "Ada", maxRentals: 2 })
await send(commandBus, RegisterCustomer, { customerId: "linus", name: "Linus", maxRentals: 2 })

// Same tool, two customers: both decisions read the tool's events.
const sameTool = await Promise.allSettled([
  send(commandBus, RentTool, { toolId: "t-1", customerId: "ada" }),
  send(commandBus, RentTool, { toolId: "t-1", customerId: "linus" }),
])

for (const outcome of sameTool) {
  if (outcome.status === "fulfilled") console.log("fulfilled", outcome.value)
  else console.log("rejected", isConflict(outcome.reason), outcome.reason.message)
}
