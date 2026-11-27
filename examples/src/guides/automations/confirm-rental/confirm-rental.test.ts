/// <reference types="../../../../../../kronos-ts/node_modules/bun-types" />
import { expect, it } from "bun:test"
import { event, events, fixture, noCommands } from "@kronos-ts/test"
import { ToolRented } from "../../../toolstore/slices/toolstore/events"
import { testInfrastructure } from "../../../toolstore/test"
import { confirmRental } from "."

// A notifications system that records what it was asked to send.
const sent: { notification: { customerId: string; text: string }; idempotencyKey: string }[] = []
const notifications = {
  send: async (notification: { customerId: string; text: string }, idempotencyKey: string) =>
    void sent.push({ notification, idempotencyKey }),
}

const { app, eventProcessor, deadLettering } = await testInfrastructure()
const scenarios = fixture(app(confirmRental(notifications, eventProcessor, deadLettering)))

it("tells the customer when a tool is rented", async () => {
  const rental = { toolId: crypto.randomUUID(), customerId: crypto.randomUUID() }
  await scenarios.when(event(ToolRented, rental)).then(noCommands(), events(event(ToolRented, rental)))
  expect(sent.filter((call) => call.notification.customerId === rental.customerId)).toEqual([
    { notification: { customerId: rental.customerId, text: `You have rented ${rental.toolId}.` }, idempotencyKey: expect.any(String) },
  ])
})
