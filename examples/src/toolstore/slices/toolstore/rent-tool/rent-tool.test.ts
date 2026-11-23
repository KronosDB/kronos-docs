/// <reference types="../../../../../../../kronos-ts/node_modules/bun-types" />
import { it } from "bun:test"
import { command, event, events, fixture, noEvents, result } from "@kronos-ts/test"
import { testInfrastructure } from "../../../test"
import { CustomerRegistered, ToolAdded, ToolRented } from "../events"
import { RentTool } from "./command"
import { rentTool } from "."

const { app } = await testInfrastructure()
const scenarios = fixture(app(rentTool()))

// Every scenario shares the app, so each one uses ids of its own.
const drill = () => ({ toolId: crypto.randomUUID(), model: "DCD791", name: "Cordless drill" })
const customer = (maxRentals: number) => ({ customerId: crypto.randomUUID(), name: "Ada", maxRentals })

it("rents an available tool to a registered customer", async () => {
  const [tool, ada] = [drill(), customer(1)]
  const rental = { toolId: tool.toolId, customerId: ada.customerId }
  await scenarios
    .given(event(ToolAdded, tool), event(CustomerRegistered, ada))
    .when(command(RentTool, rental))
    .then(result({ ok: true }), events(event(ToolRented, rental)))
})

it("refuses a tool that is out with another customer", async () => {
  const [tool, ada, linus] = [drill(), customer(1), customer(1)]
  await scenarios
    .given(event(ToolAdded, tool), event(CustomerRegistered, ada), event(CustomerRegistered, linus))
    .given(event(ToolRented, { toolId: tool.toolId, customerId: linus.customerId }))
    .when(command(RentTool, { toolId: tool.toolId, customerId: ada.customerId }))
    .then(result({ ok: false, rejection: "TOOL_UNAVAILABLE", toolId: tool.toolId }), noEvents())
})

it("refuses a customer who is not registered", async () => {
  const [tool, ada] = [drill(), customer(1)]
  await scenarios
    .given(event(ToolAdded, tool))
    .when(command(RentTool, { toolId: tool.toolId, customerId: ada.customerId }))
    .then(result({ ok: false, rejection: "CUSTOMER_UNKNOWN", customerId: ada.customerId }), noEvents())
})

it("refuses a customer at their limit", async () => {
  const [first, second, ada] = [drill(), drill(), customer(1)]
  await scenarios
    .given(event(ToolAdded, first), event(ToolAdded, second), event(CustomerRegistered, ada))
    .given(event(ToolRented, { toolId: first.toolId, customerId: ada.customerId }))
    .when(command(RentTool, { toolId: second.toolId, customerId: ada.customerId }))
    .then(result({ ok: false, rejection: "OVER_LIMIT", customerId: ada.customerId, maxRentals: 1 }), noEvents())
})

it("rents a tool once when the command is sent again", async () => {
  const [tool, ada] = [drill(), customer(1)]
  const rental = { toolId: tool.toolId, customerId: ada.customerId }
  await scenarios
    .given(event(ToolAdded, tool), event(CustomerRegistered, ada), event(ToolRented, rental))
    .when(command(RentTool, rental))
    .then(result({ ok: true }), noEvents())
})
