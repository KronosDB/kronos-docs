/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { expect, it } from "bun:test"
import { command, event, fixture } from "@kronos-ts/test"
import { testInfrastructure } from "../../toolstore/test"
import { CustomerRegistered, ToolAdded } from "../../toolstore/slices/toolstore/events"
import { rentTool } from "../../toolstore/slices/toolstore/rent-tool"
import { RentTool } from "../../toolstore/slices/toolstore/rent-tool/command"
import { rentEndpoint } from "./caller"

const { app } = await testInfrastructure()
const toolstore = app(rentTool())
const scenarios = fixture(toolstore)
const [commandBus] = toolstore.commandBuses

it("turns each outcome into its own reply", async () => {
  await scenarios
    .given(
      event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }),
      event(ToolAdded, { toolId: "t-2", model: "D24000", name: "Tile saw" }),
      event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1 }),
      event(CustomerRegistered, { customerId: "linus", name: "Linus", maxRentals: 1 }),
    )
    .when(command(RentTool, { toolId: "t-1", customerId: "ada" }))
    .then()

  expect(await rentEndpoint(commandBus!, "t-1", "ada")).toEqual({ status: 200, body: { message: "ada rented t-1" } })
  expect(await rentEndpoint(commandBus!, "t-1", "linus")).toEqual({
    status: 409,
    body: { message: "t-1 is not on the shelf" },
  })
  expect(await rentEndpoint(commandBus!, "t-2", "nobody")).toEqual({
    status: 404,
    body: { message: "nobody is not registered" },
  })
  expect(await rentEndpoint(commandBus!, "t-2", "ada")).toEqual({
    status: 409,
    body: { message: "ada is at their rental limit (1)" },
  })
})
