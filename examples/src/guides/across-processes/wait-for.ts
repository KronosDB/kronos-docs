import { setTimeout as sleep } from "node:timers/promises"

/** Reads until `ready` accepts the value. Projections catch up after the command returns. */
export async function waitFor<Value>(read: () => Promise<Value>, ready: (value: Value) => boolean): Promise<Value> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const value = await read()
    if (ready(value)) return value
    await sleep(25)
  }
  throw new Error("timed out waiting for the projection")
}
