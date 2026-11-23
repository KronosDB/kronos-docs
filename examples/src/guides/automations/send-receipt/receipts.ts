/**
 * What sending a receipt needs from the receipts system: only the call it makes. The context hands in the real one,
 * a test one that records.
 */
export type Receipts = {
  send(receipt: { toolId: string; customerId: string }, idempotencyKey: string): Promise<void>
}
