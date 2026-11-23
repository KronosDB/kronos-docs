/// <reference types="../../../../../../kronos-ts/node_modules/bun-types" />
import { expect, it } from "bun:test"
import { command, commands, event, events, fixture, noEvents, result } from "@kronos-ts/test"
import { ReceiptSent, ToolRented } from "../../../toolstore/slices/toolstore/events"
import { testInfrastructure } from "../../../toolstore/test"
import { SendReceipt } from "./command"
import { sendReceipt } from "."

// A receipts system that records what it was asked to send.
const sent: { receipt: { toolId: string; customerId: string }; idempotencyKey: string }[] = []
const receipts = { send: async (receipt: { toolId: string; customerId: string }, idempotencyKey: string) => void sent.push({ receipt, idempotencyKey }) }

const { app, eventProcessor, deadLettering } = await testInfrastructure()
const scenarios = fixture(app(sendReceipt(receipts, eventProcessor, deadLettering)))

it("sends a receipt when a tool is rented", async () => {
  const rental = { toolId: crypto.randomUUID(), customerId: crypto.randomUUID() }
  await scenarios
    .when(event(ToolRented, rental))
    .then(commands(command(SendReceipt, rental)), events(event(ToolRented, rental), event(ReceiptSent, rental)))
  expect(sent.filter((call) => call.receipt.toolId === rental.toolId)).toEqual([
    { receipt: rental, idempotencyKey: `receipt-${rental.toolId}-${rental.customerId}` },
  ])
})

it("does not send a receipt again for a rental whose receipt was sent", async () => {
  const rental = { toolId: crypto.randomUUID(), customerId: crypto.randomUUID() }
  await scenarios
    .given(event(ReceiptSent, rental))
    .when(event(ToolRented, rental))
    .then(commands(command(SendReceipt, rental)), events(event(ToolRented, rental)))
  expect(sent.filter((call) => call.receipt.toolId === rental.toolId)).toEqual([])
})

it("sends a receipt once when the command is sent again", async () => {
  const rental = { toolId: crypto.randomUUID(), customerId: crypto.randomUUID() }
  await scenarios
    .given(event(ReceiptSent, rental))
    .when(command(SendReceipt, rental))
    .then(result({ ok: true }), noEvents())
  expect(sent.filter((call) => call.receipt.toolId === rental.toolId)).toEqual([])
})
