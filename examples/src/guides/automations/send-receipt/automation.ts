import { eventHandler } from "@kronos-ts/core"
import { ToolRented } from "../../../toolstore/slices/toolstore/events"
import { SendReceipt } from "./command"
import { Receipt } from "./state"

/** When a tool is rented, send its receipt, unless it has been sent already. */
export const automation = [
  eventHandler(ToolRented, async ({ payload }, ctx) => {
    if ((await ctx.load(Receipt, payload)).sent) return
    await ctx.send(SendReceipt, payload)
  }),
]
