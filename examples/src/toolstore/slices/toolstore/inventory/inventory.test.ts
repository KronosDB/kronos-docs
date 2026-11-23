/// <reference types="../../../../../../../kronos-ts/node_modules/bun-types" />
import { it } from "bun:test"
import { event, fixture, query } from "@kronos-ts/test"
import { testInfrastructure } from "../../../test"
import { CustomerRegistered, ToolAdded, ToolRented } from "../events"
import { GetInventory } from "./query"
import { inventory } from "."

const { app, eventProcessor } = await testInfrastructure({ db: true })
const scenarios = fixture(app(inventory(eventProcessor)))

it("shows a tool as rented once it is out", async () => {
  await scenarios
    .storyline(query(GetInventory, {}))
    .shows([])
    .after(event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }))
    .shows([{ toolId: "t-1", name: "Cordless drill", available: true }])
    .after(
      event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1 }),
      event(ToolRented, { toolId: "t-1", customerId: "ada" }),
    )
    .shows([{ toolId: "t-1", name: "Cordless drill", available: false }])
})
