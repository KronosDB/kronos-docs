/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { it } from "bun:test"
import { event, fixture, query } from "@kronos-ts/test"
import { CustomerRegistered, ToolAdded, ToolRented } from "../../toolstore/slices/toolstore/events"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { testInfrastructure } from "../../toolstore/test"
import { inventoryByStatements } from "./statements"

const { app, eventProcessor } = await testInfrastructure({ db: true })
const scenarios = fixture(app(inventoryByStatements(eventProcessor)))

it("writes a batch of events in one statement per change", async () => {
  await scenarios
    .storyline(query(GetInventory, {}))
    .shows([])
    .after(
      event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }),
      event(ToolAdded, { toolId: "t-2", model: "D24000", name: "Tile saw" }),
      event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1 }),
      event(ToolRented, { toolId: "t-1", customerId: "ada" }),
    )
    .shows([
      { toolId: "t-1", name: "Cordless drill", available: false },
      { toolId: "t-2", name: "Tile saw", available: true },
    ])
})
