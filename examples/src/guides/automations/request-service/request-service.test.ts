/// <reference types="../../../../../../kronos-ts/node_modules/bun-types" />
import { it } from "bun:test"
import { command, commands, event, events, fixture, noCommands, noEvents, result } from "@kronos-ts/test"
import { ServiceRequested, ToolRented } from "../../../toolstore/slices/toolstore/events"
import { testInfrastructure } from "../../../toolstore/test"
import { RequestService } from "./command"
import { requestService } from "."

const { app, eventProcessor } = await testInfrastructure()
const scenarios = fixture(app(requestService(eventProcessor)))

const rentals = (toolId: string, count: number) =>
  Array.from({ length: count }, () => event(ToolRented, { toolId, customerId: crypto.randomUUID() }))

it("requests a service at the tenth rental", async () => {
  const toolId = crypto.randomUUID()
  const tenth = event(ToolRented, { toolId, customerId: crypto.randomUUID() })
  await scenarios
    .given(...rentals(toolId, 9))
    .when(tenth)
    .then(commands(command(RequestService, { toolId })), events(tenth, event(ServiceRequested, { toolId })))
})

it("does not request a service before the tenth rental", async () => {
  const toolId = crypto.randomUUID()
  const ninth = event(ToolRented, { toolId, customerId: crypto.randomUUID() })
  await scenarios.given(...rentals(toolId, 8)).when(ninth).then(noCommands(), events(ninth))
})

it("counts again from the requested service", async () => {
  const toolId = crypto.randomUUID()
  const next = event(ToolRented, { toolId, customerId: crypto.randomUUID() })
  await scenarios
    .given(...rentals(toolId, 10), event(ServiceRequested, { toolId }))
    .when(next)
    .then(noCommands(), events(next))
})

it("requests a service once when the command is sent again", async () => {
  const toolId = crypto.randomUUID()
  await scenarios
    .given(...rentals(toolId, 10), event(ServiceRequested, { toolId }))
    .when(command(RequestService, { toolId }))
    .then(result({ ok: true }), noEvents())
})
