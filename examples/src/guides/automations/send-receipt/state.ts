import { state } from "@kronos-ts/core"
import { z } from "zod"
import { ReceiptSent } from "../../../toolstore/slices/toolstore/events"

/** Whether the receipt for this rental has been sent. */
export const Receipt = state({
  id: { toolId: z.string(), customerId: z.string() },
  tags: (id) => ({ toolId: id.toolId, customerId: id.customerId }),
  evolve: [
    (): { sent: boolean } => ({ sent: false }),
    [ReceiptSent, () => ({ sent: true })],
  ],
})
