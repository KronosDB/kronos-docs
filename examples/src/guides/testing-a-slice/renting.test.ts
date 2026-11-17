/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { afterEach, describe, it } from "bun:test"
import { command, event, events, fixture, noEvents, query, result } from "@kronos-ts/test"
import { CustomerRegistered, GetInventory, RentTool, ToolAdded, ToolRented } from "../../start/messages"
import { rentingSlice } from "./app"

const running: Array<{ stop(): Promise<void> }> = []
afterEach(async () => {
  await Promise.all(running.splice(0).map((app) => app.stop()))
})

function freshFixture() {
  const app = rentingSlice()
  running.push(app)
  return fixture(app)
}

const drill = event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" })
const tileSaw = event(ToolAdded, { toolId: "t-2", model: "D24000", name: "Tile saw" })
const ada = event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1 })

describe("RentTool", () => {
  it("rents an available tool to a registered customer", async () => {
    await freshFixture()
      .given(drill, ada)
      .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
      .then(result({ rented: true }), events(event(ToolRented, { toolId: "t-1", customerId: "ada" })))
  })

  it("refuses a tool the store never added", async () => {
    await freshFixture()
      .given(ada)
      .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
      .then(result({ rented: false, reason: "tool-unavailable" }), noEvents())
  })

  it("refuses a tool that is already out", async () => {
    await freshFixture()
      .given(drill, ada, event(CustomerRegistered, { customerId: "linus", name: "Linus", maxRentals: 1 }))
      .given(event(ToolRented, { toolId: "t-1", customerId: "linus" }))
      .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
      .then(result({ rented: false, reason: "tool-unavailable" }), noEvents())
  })

  it("refuses an unknown customer", async () => {
    await freshFixture()
      .given(drill)
      .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
      .then(result({ rented: false, reason: "customer-unknown" }), noEvents())
  })

  it("refuses a customer at their limit", async () => {
    await freshFixture()
      .given(drill, tileSaw, ada, event(ToolRented, { toolId: "t-1", customerId: "ada" }))
      .when(command(RentTool, { toolId: "t-2", customerId: "ada" }))
      .then(result({ rented: false, reason: "over-limit" }), noEvents())
  })
})

describe("GetInventory", () => {
  it("shows a rented tool as unavailable", async () => {
    await freshFixture()
      .given(drill, tileSaw, ada, event(ToolRented, { toolId: "t-1", customerId: "ada" }))
      .when(query(GetInventory, {}))
      .then(
        result([
          { toolId: "t-1", name: "Cordless drill", available: false },
          { toolId: "t-2", name: "Tile saw", available: true },
        ]),
      )
  })

  it("follows the inventory as events arrive", async () => {
    await freshFixture()
      .storyline(query(GetInventory, {}))
      .shows([])
      .after(drill)
      .shows([{ toolId: "t-1", name: "Cordless drill", available: true }])
      .after(ada, event(ToolRented, { toolId: "t-1", customerId: "ada" }))
      .shows([{ toolId: "t-1", name: "Cordless drill", available: false }])
  })
})
