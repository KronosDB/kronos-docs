import { state } from "@kronos-ts/core"
import { z } from "zod"
import { ServiceRequested, ToolRented } from "../../../toolstore/slices/toolstore/events"

/** A tool goes for service after this many rentals. */
export const RENTALS_BETWEEN_SERVICES = 10

/** How many times the tool has been rented since its last service was requested. */
export const Wear = state({
  id: { toolId: z.string() },
  tags: (id) => ({ toolId: id.toolId }),
  evolve: [
    (): { rentalsSinceService: number } => ({ rentalsSinceService: 0 }),
    [ToolRented, (wear) => ({ rentalsSinceService: wear.rentalsSinceService + 1 })],
    [ServiceRequested, () => ({ rentalsSinceService: 0 })],
  ],
})
