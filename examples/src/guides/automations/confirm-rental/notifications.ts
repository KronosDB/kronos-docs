/** What confirming a rental needs from the notifications system: only the call it makes. */
export type Notifications = {
  send(notification: { customerId: string; text: string }, idempotencyKey: string): Promise<void>
}
