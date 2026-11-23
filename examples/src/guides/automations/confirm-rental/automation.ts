import { eventHandler } from "@kronos-ts/core"
import { ToolRented } from "../../../toolstore/slices/toolstore/events"
import type { Notifications } from "./notifications"

/** When a tool is rented, tell the customer. The event's identifier is the key, so a repeated call is ignored. */
export const automation = (notifications: Notifications) => [
  eventHandler(ToolRented, async ({ identifier, payload }) => {
    await notifications.send({ customerId: payload.customerId, text: `You have rented ${payload.toolId}.` }, identifier)
  }),
]
