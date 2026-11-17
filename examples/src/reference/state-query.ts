import { state, withNamespace } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolAdded = ns.event("ToolAdded", {
  payload: z.object({ toolId: z.string(), model: z.string(), name: z.string() }),
  tags: { toolId: (payload) => payload.toolId },
})

const CustomerRegistered = ns.event("CustomerRegistered", {
  payload: z.object({ customerId: z.string(), name: z.string(), maxRentals: z.number() }),
  tags: { customerId: (payload) => payload.customerId },
})

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const Tool = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ exists: false }),
    [ToolAdded, (tool) => ({ ...tool, exists: true })],
  ],
})

const Renting = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => ({ toolId: id.toolId, customerId: id.customerId }),
  evolve: [
    () => ({ toolAvailable: false, customerRegistered: false, rentals: 0 }),
    [ToolAdded, (renting) => ({ ...renting, toolAvailable: true })],
    [CustomerRegistered, (renting) => ({ ...renting, customerRegistered: true })],
    [ToolRented, (renting) => ({ ...renting, rentals: renting.rentals + 1 })],
  ],
})

const RentalsAnywhere = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => [{ toolId: id.toolId }, { customerId: id.customerId }],
  evolve: [() => 0, [ToolRented, (count) => count + 1]],
})

try {
  state({
    id: { toolId: z.string() },
    tags: (id) => ({ toolId: id.toolId }),
    evolve: [() => 0, [CustomerRegistered, (count) => count + 1]],
  })
} catch (error) {
  console.log((error as Error).message)
}

console.log(JSON.stringify(Tool.query({ toolId: "t-1" })))
console.log(JSON.stringify(Renting.query({ toolId: "t-1", customerId: "ada" }), null, 2))
console.log(JSON.stringify(RentalsAnywhere.query({ toolId: "t-1", customerId: "ada" })))
