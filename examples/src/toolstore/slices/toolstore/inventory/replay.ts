import type { RunningProcessor } from "@kronos-ts/core"
import { postgresTransaction } from "@kronos-ts/postgres"

/** Rebuilds the inventory from the first event. The table is emptied in the transaction that rewinds the position. */
export async function replayInventory(processor: RunningProcessor): Promise<void> {
  await processor.stop()
  await processor.resetTokens(0n, async (uow) => {
    const tx = await postgresTransaction(uow)
    await tx.query(`TRUNCATE inventory`)
  })
  await processor.start()
}
