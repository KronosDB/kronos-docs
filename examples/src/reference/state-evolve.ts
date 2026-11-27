import { state, withNamespace } from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

const ToolRented = ns.event("ToolRented", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

const ToolReturned = ns.event("ToolReturned", {
  payload: z.object({ toolId: z.string(), customerId: z.string() }),
  tags: {
    toolId: (payload) => payload.toolId,
    customerId: (payload) => payload.customerId,
  },
})

// An initial state that ignores the id, and one evolver per event type.
export const Rental = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    () => ({ heldBy: undefined as string | undefined }),
    [ToolRented, (rental, { payload }) => ({ ...rental, heldBy: payload.customerId })],
    [ToolReturned, (rental) => ({ ...rental, heldBy: undefined })],
  ],
})

// An initial state that reads the id it is folded for.
export const CustomerRentals = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    (id) => ({ customerId: id.customerId, toolIds: [] as string[] }),
    [
      ToolRented,
      (rentals, { payload }) => ({ ...rentals, toolIds: [...rentals.toolIds, payload.toolId] }),
    ],
    [
      ToolReturned,
      (rentals, { payload }) => ({
        ...rentals,
        toolIds: rentals.toolIds.filter((toolId) => toolId !== payload.toolId),
      }),
    ],
  ],
})

// An evolver may be async and returns a promise of the next state.
export const RentalCount = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => 0,
    [ToolRented, async (count) => count + 1],
  ],
})

// When the initial state leaves the type open (empty arrays, unions), annotate it once.
type RentalLogState = { toolIds: string[]; lastReturned: string | undefined }

export const RentalLog = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    (): RentalLogState => ({ toolIds: [], lastReturned: undefined }),
    [ToolRented, (log, { payload }) => ({ ...log, toolIds: [...log.toolIds, payload.toolId] })],
    [ToolReturned, (log, { payload }) => ({ ...log, lastReturned: payload.toolId })],
  ],
})

// With no evolvers the state folds nothing and its query is the tag record alone.
export const CustomerActivity = state({
  id: { customerId: z.string() },
  tags: (id) => ({ customerId: id.customerId }),
  evolve: [
    () => ({ seen: false }),
  ],
})

console.log(JSON.stringify(CustomerActivity.query({ customerId: "ada" })))
