import type { RunningProcessor, UnitOfWork } from "@kronos-ts/core"
import { postgresTransaction } from "@kronos-ts/postgres"

export async function truncateInventory(uow: UnitOfWork): Promise<void> {
  const tx = await postgresTransaction(uow)
  await tx.query(`TRUNCATE inventory`)
}

export async function replayInventory(processor: RunningProcessor, from = 0n): Promise<void> {
  await processor.stop()
  await processor.resetTokens(from, truncateInventory)
  await processor.start()
}
