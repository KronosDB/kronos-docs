/// <reference types="../../../../../kronos-ts/node_modules/bun-types" />
import { expect, it } from "bun:test"
import { event, fixture, query } from "@kronos-ts/test"
import { CustomerRegistered, ToolAdded, ToolRented } from "../../toolstore/slices/toolstore/events"
import { GetInventory } from "../../toolstore/slices/toolstore/inventory/query"
import { testInfrastructure } from "../../toolstore/test"
import { inventory, segmentedInventory } from "."

const tools = Array.from({ length: 1500 }, (_, index) => `t-${String(index).padStart(4, "0")}`)
const history = [
  event(CustomerRegistered, { customerId: "ada", name: "Ada", maxRentals: 1000 }),
  ...tools.map((toolId) => event(ToolAdded, { toolId, model: "DCD791", name: `Drill ${toolId}` })),
  ...tools.filter((_, index) => index % 3 === 0).map((toolId) => event(ToolRented, { toolId, customerId: "ada" })),
]

const batchedRun = await testInfrastructure({ db: true })
const segmentedRun = await testInfrastructure({ db: true })
const variants = [
  ["batched and concurrent", fixture(batchedRun.app(inventory(batchedRun.eventProcessor)))],
  ["in four segments", fixture(segmentedRun.app(segmentedInventory(segmentedRun.eventProcessor)))],
] as const

for (const [label, scenarios] of variants) {
  it(`writes the same rows ${label}`, async () => {
    const outcome = await scenarios.given(...history).when(query(GetInventory, {})).then()
    const rows = outcome.result as Array<{ toolId: string; name: string; available: boolean }>
    expect(rows).toHaveLength(1500)
    expect(rows.filter((row) => !row.available)).toHaveLength(500)
    expect(rows[0]).toEqual({ toolId: "t-0000", name: "Drill t-0000", available: false })
  })
}
