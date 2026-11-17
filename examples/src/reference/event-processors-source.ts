import {
  globalSequenceToken,
  type MessageStream,
  type SequencedEvent,
  type StreamableEventSource,
  type StreamingCondition,
  type TrackingToken,
} from "@kronos-ts/core"

// A source over an array: what a store adds to read its log as a stream
export function arraySource(log: SequencedEvent[]): StreamableEventSource & { wake(): void } {
  const waiting = new Set<() => void>()

  return {
    open(condition: StreamingCondition): MessageStream<SequencedEvent> {
      let cursor = condition.position
      let callback: (() => void) | undefined
      const wake = () => callback?.()
      waiting.add(wake)

      const findNext = () => log.find((entry) => entry.sequence >= cursor)

      return {
        next() {
          const found = findNext()
          if (found) cursor = found.sequence + 1n
          return found
        },
        peek: findNext,
        hasNextAvailable: () => findNext() !== undefined,
        isCompleted: () => false,
        error: () => undefined,
        setCallback(listener) {
          callback = listener
        },
        close() {
          callback = undefined
          waiting.delete(wake)
        },
      }
    },

    async firstToken(): Promise<TrackingToken> {
      return globalSequenceToken(0n)
    },

    async latestToken(): Promise<TrackingToken> {
      return globalSequenceToken(BigInt(log.length))
    },

    async getHeadPosition(): Promise<bigint> {
      return BigInt(log.length)
    },

    wake() {
      for (const wake of waiting) wake()
    },
  }
}
