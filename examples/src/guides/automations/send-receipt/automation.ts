import { eventHandler } from "@kronos-ts/core"
import { ToolRented } from "../../../toolstore/slices/toolstore/events"
import { SendReceipt } from "./command"

/** When a tool is rented, send its receipt. Whether it was sent already is the command's decision. */
export const automation = [
  eventHandler(ToolRented, async ({ payload }, ctx) => {
    await ctx.send(SendReceipt, payload)
  }),
]
