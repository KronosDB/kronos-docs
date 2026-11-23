import { commandHandler } from "@kronos-ts/core"
import { ReceiptSent } from "../../../toolstore/slices/toolstore/events"
import { SendReceipt } from "./command"
import type { Receipts } from "./receipts"
import { Receipt } from "./state"

/** Calls the receipts system first, then records that the receipt was sent. A receipt already sent is not sent again. */
export const handle = (receipts: Receipts) =>
  commandHandler(SendReceipt, async ({ payload }, ctx) => {
    const receipt = await ctx.load(Receipt, payload)
    if (receipt.sent) return { ok: true }
    await receipts.send(payload, `receipt-${payload.toolId}-${payload.customerId}`)
    ctx.append(ReceiptSent, payload)
    return { ok: true }
  })
