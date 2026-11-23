import { setTimeout as sleep } from "node:timers/promises"
import type { EventStore, RunningProcessor } from "@kronos-ts/core"

/** Resolves once the processor has handled every event in the log. Event handlers run after a command returns. */
export async function caughtUp(processor: RunningProcessor, eventStore: EventStore): Promise<void> {
  const head = await eventStore.getHeadPosition()
  while (processor.position < head) await sleep(10)
}
