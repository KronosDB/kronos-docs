/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { afterAll, describe, expect, it } from "bun:test"
import { command, error, event, events, fixture, noEvents, result } from "@kronos-ts/test"
import { AddTool, CustomerRegistered, RentTool, ToolAdded, ToolRented } from "../../start/messages"
import { toolStore } from "./app"
import { rentEndpoint } from "./caller"

const app = toolStore()
const toolStoreFixture = fixture(app)
const [commandBus] = app.commandBuses

afterAll(() => app.stop())

describe("renting", () => {
  it("answers a refusal as a result and appends nothing", async () => {
    await toolStoreFixture
      .given(
        event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }),
        event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1 }),
        event(ToolRented, { toolId: "t-1", customerId: "ada" }),
      )
      .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
      .then(result({ rented: false, reason: "tool-unavailable" }), noEvents())
  })

  it("refuses a duplicate tool by throwing", async () => {
    await toolStoreFixture
      .given(event(ToolAdded, { toolId: "t-2", model: "D24000", name: "Tile saw" }))
      .when(command(AddTool, { toolId: "t-2", model: "D24000", name: "Tile saw" }))
      .then(error("already exists"), noEvents())
  })

  it("rents when nothing stands in the way", async () => {
    await toolStoreFixture
      .given(
        event(ToolAdded, { toolId: "t-3", model: "DWE7491", name: "Table saw" }),
        event(CustomerRegistered, { customerId: "grace", name: "Grace", maxRentals: 2 }),
      )
      .when(command(RentTool, { toolId: "t-3", customerId: "grace" }))
      .then(result({ rented: true }), events(event(ToolRented, { toolId: "t-3", customerId: "grace" })))
  })
})

describe("the caller", () => {
  it("turns each outcome into its own reply", async () => {
    await toolStoreFixture
      .given(
        event(ToolAdded, { toolId: "t-4", model: "DCD791", name: "Cordless drill" }),
        event(ToolAdded, { toolId: "t-5", model: "D24000", name: "Tile saw" }),
        event(CustomerRegistered, { customerId: "linus", name: "Linus", maxRentals: 1 }),
      )
      .when(command(RentTool, { toolId: "t-4", customerId: "linus" }))
      .then()

    expect(await rentEndpoint(commandBus!, "t-4", "linus")).toEqual({
      status: 409,
      body: { message: "t-4 is not on the shelf" },
    })
    expect(await rentEndpoint(commandBus!, "t-5", "nobody")).toEqual({
      status: 404,
      body: { message: "nobody is not registered" },
    })
    expect(await rentEndpoint(commandBus!, "t-5", "linus")).toEqual({
      status: 422,
      body: { message: "linus is at their rental limit" },
    })
  })

  it("answers 200 when the tool is rented", async () => {
    await toolStoreFixture
      .given(event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 2 }))
      .when(command(AddTool, { toolId: "t-6", model: "DWE7491", name: "Table saw" }))
      .then()

    expect(await rentEndpoint(commandBus!, "t-6", "ada")).toEqual({
      status: 200,
      body: { message: "ada rented t-6" },
    })
  })
})
