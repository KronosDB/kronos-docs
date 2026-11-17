import {
  isNoHandler,
  kronos,
  localQueryBus,
  query,
  queryHandler,
  unitOfWork,
  withNamespace,
} from "@kronos-ts/core"
import { z } from "zod"

const ns = withNamespace("toolstore")

export const GetInventory = ns.query("GetInventory", {
  payload: z.object({}),
  result: z.array(z.object({ toolId: z.string(), name: z.string(), available: z.boolean() })),
})

export const GetCustomerRentals = ns.query("GetCustomerRentals", {
  payload: z.object({ customerId: z.string() }),
  result: z.array(z.string()),
})

export const GetCustomerRentalNames = ns.query("GetCustomerRentalNames", {
  payload: z.object({ customerId: z.string() }),
  result: z.array(z.string()),
})

const tools = new Map([
  ["t-1", { toolId: "t-1", name: "Cordless drill", available: false }],
  ["t-2", { toolId: "t-2", name: "Tile saw", available: true }],
])
const rentals = new Map([["ada", ["t-1"]]])

export const getInventory = queryHandler(GetInventory, () => [...tools.values()])

export const getCustomerRentals = queryHandler(
  GetCustomerRentals,
  ({ payload }) => rentals.get(payload.customerId) ?? [],
)

export const getCustomerRentalNames = queryHandler(
  GetCustomerRentalNames,
  async ({ payload }, ctx) => {
    const toolIds = await ctx.query(GetCustomerRentals, { customerId: payload.customerId })
    return toolIds.map((toolId) => tools.get(toolId)?.name ?? toolId)
  },
)

const queryBus = localQueryBus(unitOfWork)

const app = kronos({
  queryHandlers: [
    { ...getInventory, queryBus },
    { ...getCustomerRentals, queryBus },
    { ...getCustomerRentalNames, queryBus },
  ],
})

const inventory = await query(queryBus, GetInventory, {})
const names = await query(queryBus, GetCustomerRentalNames, { customerId: "ada" })

const emptyBus = localQueryBus(unitOfWork)
try {
  await query(emptyBus, GetInventory, {})
} catch (error) {
  if (isNoHandler(error)) console.log("no handler:", error.message)
}

await app.stop()
console.log(inventory, names)
