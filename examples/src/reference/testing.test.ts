/// <reference types="../../../../kronos-ts/node_modules/bun-types" />
import { afterAll, describe, expect, it } from "bun:test"
import {
  any,
  command,
  commands,
  error,
  event,
  events,
  FIXTURE_EPOCH,
  fixture,
  noCommands,
  noEvents,
  query,
  result,
  ScenarioAssertionError,
  scheduled,
  type Outcome,
} from "@kronos-ts/test"
import { z } from "zod"
import {
  AddTool,
  CustomerRegistered,
  GetInventory,
  RegisterCustomer,
  RentTool,
  ToolAdded,
  ToolRented,
} from "../start/messages"
import { RentalOverdue, SEVEN_DAYS, toolStore } from "./testing-app"

const app = toolStore()
const toolStoreFixture = fixture(app)

afterAll(() => app.stop())

describe("a command", () => {
  it("records a tool", async () => {
    await toolStoreFixture
      .when(command(AddTool, { toolId: "t-10", model: "DCD791", name: "Cordless drill" }))
      .then(events(event(ToolAdded, { toolId: "t-10", model: "DCD791", name: "Cordless drill" })))
  })

  it("claims one field and leaves the rest open", async () => {
    await toolStoreFixture
      .when(command(AddTool, { toolId: "t-11", model: "D24000", name: "Tile saw" }))
      .then(events(event(ToolAdded, { toolId: "t-11", model: any(), name: any(z.string()) })))
  })

  it("rents a tool and returns the outcome", async () => {
    await toolStoreFixture
      .given(
        event(ToolAdded, { toolId: "t-12", model: "DWE7491", name: "Table saw" }),
        event(CustomerRegistered, { customerId: "ada-12", name: "Ada", maxRentals: 2 }),
      )
      .when(command(RentTool, { toolId: "t-12", customerId: "ada-12" }))
      .then(
        result({ ok: true }),
        events(event(ToolRented, { toolId: "t-12", customerId: "ada-12" })),
      )
  })

  it("throws for an id that already names another tool", async () => {
    await toolStoreFixture
      .given(event(ToolAdded, { toolId: "t-13", model: "DCD791", name: "Cordless drill" }))
      .when(command(AddTool, { toolId: "t-13", model: "D24000", name: "Tile saw" }))
      .then(error("is already a DCD791"), noEvents())
  })

  it("matches an error by pattern or by predicate", async () => {
    const duplicate = () =>
      toolStoreFixture
        .given(event(ToolAdded, { toolId: "t-14", model: "DCD791", name: "Cordless drill" }))
        .when(command(AddTool, { toolId: "t-14", model: "D24000", name: "Tile saw" }))

    await duplicate().then(error(/^tool t-14 is already a DCD791$/))
    await duplicate().then(error((thrown) => thrown instanceof Error))
  })
})

describe("a refusal", () => {
  it("is a result, with no event", async () => {
    await toolStoreFixture
      .given(event(CustomerRegistered, { customerId: "ada-15", name: "Ada", maxRentals: 2 }))
      .when(command(RentTool, { toolId: "t-15", customerId: "ada-15" }))
      .then(result({ ok: false, rejection: "TOOL_UNAVAILABLE", toolId: "t-15" }), noEvents())
  })
})

describe("a query", () => {
  it("answers from the inventory the given events built", async () => {
    await toolStoreFixture
      .given(event(ToolAdded, { toolId: "t-16", model: "DCD791", name: "Cordless drill" }))
      .when(query(GetInventory, {}))
      .then(({ result: rows }: Outcome) => {
        const inventory = rows as Array<{ toolId: string; available: boolean }>
        const row = inventory.find((candidate) => candidate.toolId === "t-16")
        if (row?.available !== true) throw new Error("t-16 should be available")
      })
  })
})

describe("a storyline", () => {
  it("walks the inventory from a rented tool to a returned one", async () => {
    await toolStoreFixture
      .storyline(query(GetInventory, {}))
      .after(event(ToolAdded, { toolId: "t-17", model: "DCD791", name: "Cordless drill" }))
      .shows(({ result: rows }: Outcome) => {
        const inventory = rows as Array<{ toolId: string; available: boolean }>
        if (inventory.find((row) => row.toolId === "t-17")?.available !== true) throw new Error("expected available")
      })
      .after(event(ToolRented, { toolId: "t-17", customerId: "ada" }))
      .shows(({ result: rows }: Outcome) => {
        const inventory = rows as Array<{ toolId: string; available: boolean }>
        if (inventory.find((row) => row.toolId === "t-17")?.available !== false) throw new Error("expected rented")
      })
  })
})

describe("an automation", () => {
  it("arms a deadline when a tool is rented", async () => {
    await toolStoreFixture
      .when(event(ToolRented, { toolId: "t-18", customerId: "ada" }))
      .then(
        events(event(ToolRented, { toolId: "t-18", customerId: "ada" })),
        scheduled(event(RentalOverdue, { toolId: "t-18", customerId: "ada" }), SEVEN_DAYS),
        noCommands(),
      )
  })

  it("fires the deadline when the clock passes it", async () => {
    await toolStoreFixture
      .when(event(ToolRented, { toolId: "t-19", customerId: "ada" }))
      .advance(SEVEN_DAYS)
      .then(
        events(
          event(ToolRented, { toolId: "t-19", customerId: "ada" }),
          event(RentalOverdue, { toolId: "t-19", customerId: "ada" }),
        ),
      )
  })

  it("expects no command", async () => {
    await toolStoreFixture
      .when(event(ToolAdded, { toolId: "t-20", model: "DCD791", name: "Cordless drill" }))
      .then(noCommands())
  })
})

describe("steps", () => {
  it("continues in the world the previous step left", async () => {
    await toolStoreFixture
      .when(command(AddTool, { toolId: "t-21", model: "DCD791", name: "Cordless drill" }))
      .then(events(event(ToolAdded, { toolId: "t-21", model: "DCD791", name: "Cordless drill" })))
      .and.when(command(RegisterCustomer, { customerId: "ada-21", name: "Ada", maxRentals: 1 }))
      .then(events(event(CustomerRegistered, { customerId: "ada-21", name: "Ada", maxRentals: 1 })))
      .and.when(command(RentTool, { toolId: "t-21", customerId: "ada-21" }))
      .then(result({ ok: true }))
      .and.when(command(RentTool, { toolId: "t-21", customerId: "grace-21" }))
      .then(result({ ok: false, rejection: "TOOL_UNAVAILABLE", toolId: "t-21" }), noEvents())
  })
})

describe("your own claim", () => {
  const rentedTo = (customerId: string) => ({ events: appended }: Outcome) => {
    const rented = appended.filter((message) => message.name.name === "ToolRented")
    if (rented.length !== 1) throw new Error(`expected one ToolRented, got ${rented.length}`)
    if ((rented[0]!.payload as { customerId: string }).customerId !== customerId) {
      throw new Error(`expected the rental to go to ${customerId}`)
    }
  }

  it("is any function of the outcome", async () => {
    await toolStoreFixture
      .given(
        event(ToolAdded, { toolId: "t-22", model: "DCD791", name: "Cordless drill" }),
        event(CustomerRegistered, { customerId: "ada-22", name: "Ada", maxRentals: 1 }),
      )
      .when(command(RentTool, { toolId: "t-22", customerId: "ada-22" }))
      .then(rentedTo("ada-22"))
  })
})

describe("commands", () => {
  it("claims no dispatched command by default", async () => {
    await toolStoreFixture
      .when(command(AddTool, { toolId: "t-23", model: "DCD791", name: "Cordless drill" }))
      .then(commands())
  })
})

describe("time", () => {
  it("stamps events from the clock the app was built on", async () => {
    const fresh = toolStore()
    const outcome = await fixture(fresh)
      .when(command(AddTool, { toolId: "t-24", model: "DCD791", name: "Cordless drill" }))
      .advance(SEVEN_DAYS)
      .then()
    await fresh.stop()

    expect(outcome.events.map((appended) => appended.timestamp)).toEqual([FIXTURE_EPOCH])
  })
})

describe("a failing claim", () => {
  it("rejects with a ScenarioAssertionError that carries the diff", async () => {
    const failure = await toolStoreFixture
      .when(command(AddTool, { toolId: "t-25", model: "DCD791", name: "Cordless drill" }))
      .then(noEvents())
      .catch((rejection: unknown) => rejection)

    expect(failure).toBeInstanceOf(ScenarioAssertionError)
    expect((failure as Error).message).toContain("unexpected")
  })
})
