# The house domain: a tool store

Every example in the docs is one system: a tool store that rents tools to its
customers. Use exactly these names.

Namespace: `withNamespace("toolstore")`. KronosDB context and bus name: `toolstore`.
Example code: `examples/src/ (start/ and guides/ for the tool store; reference/ for small snippets in the same vocabulary)`. Rental period: seven days.

| Concept | Name |
| --- | --- |
| A physical tool unit | tool — `toolId`, `model`, `name` |
| Someone who rents | customer — `customerId`, `name`, `maxRentals` |
| A tool out with a customer | rental |
| The screen at the counter | the inventory |
| Staff | staff (never "librarian") |

## Commands → events

| Command | Payload | Event | Tags |
| --- | --- | --- | --- |
| `AddTool` | toolId, model, name → result `{ ok: true }` | `ToolAdded` | toolId |
| `RegisterCustomer` | customerId, name, maxRentals → result `{ ok: true }` | `CustomerRegistered` | customerId |
| `RentTool` | toolId, customerId → result `{ ok: true }`, or `{ ok: false, rejection, ...facts }` with `TOOL_UNAVAILABLE` (toolId), `CUSTOMER_UNKNOWN` (customerId), `OVER_LIMIT` (customerId, maxRentals) | `ToolRented` | toolId, customerId |
| `ReturnTool` | toolId, customerId | `ToolReturned` | toolId, customerId |
| (scheduled) | toolId, customerId | `RentalOverdue` | toolId, customerId |
| `SuspendCustomer` | customerId, reason | `CustomerSuspended` | customerId |

Queries: `GetInventory` (rows: toolId, name, available) · `GetCustomerRentals` (customerId → toolIds).

## States

| State | Id | Shape |
| --- | --- | --- |
| `Tool` | toolId | added |
| `Customer` | customerId | registered |
| `Renting` | toolId, customerId | toolAdded, customer (`{ registered: false }` or `{ registered: true; maxRentals }`), rentals |
| `Rental` | toolId | heldBy |
| `Suspension` | customerId | suspended |

Processor names: `inventory-view`, `rental-deadlines`, `customer-rentals`.

## Rules

A customer may rent a tool when the tool is available, the customer is
registered and not suspended, and the customer is under their rental limit. A
rented tool is due back in seven days; if it is not returned in time the
customer is suspended until staff lift the suspension.

## Refusals

A business refusal the caller acts on is a command result (`RentTool`): `{ ok:
false, rejection: "UPPER_SNAKE_CODE", ...facts }`, facts being the ids and
values the decision saw that the caller may read. A command sent again after it
succeeded returns `{ ok: true }` and appends nothing (adding a tool or
registering a customer twice, a customer renting a tool they already have). A
throw is for bugs, broken invariants and infrastructure (an id that already
names another tool, append conflict). Tests assert results with `result(...)`,
not `error(...)`.

## Layout (Guides)

Getting started is one minimal in-memory file (`examples/src/start/toolstore.ts`)
and points to the Guides. The Guides section is our style guide: each guide shows
the recommended way for one task (landing page `guides/index.mdx` lists them and
the conventions, and says Kronos's open design leaves the choice to the user).
The guides share one app in
`examples/src/toolstore/`, laid out like the Kronos build kit for Eventmodelers;
the kit's rules are spread over the guides they belong to. Bare, with no helper
functions hiding the composition:
- a slice's `index.ts` exports a function returning its handlers in all three
  lists (`rentTool = () => ({ commandHandlers: [handle], queryHandlers: [], eventHandlers: [] })`);
  a read model slice takes only `eventProcessor: (name) => EventProcessor`
  (Kronos's `eventProcessor` with the stores applied, written anonymously in
  `main.ts`) and builds its own processor;
- a context's `index.ts` returns an array of its slices; `slices/index.ts`
  spreads every context's;
- `main.ts` writes the composition out: `kronos({ commandHandlers: handlers.flatMap<…>((slice) => slice.commandHandlers).map((entry) => ({ ...entry, handler: pipe(…), eventStore, commandBus, queryBus })), … })`.
  It is the only place the infrastructure meets handlers; no slice takes `pg`;
- `test.ts`: `testInfrastructure({ db? })` returns `app(...slices)` (the same
  composition, written out) and `eventProcessor`.
No `merge`, `decorate`, `wrapping`, `Slice`, `PartialProcessor` or resources types,
no `app()`. The unit of work is called `unitOfWork`, never `processing`.

## Sample data

Tools: `t-1` "Cordless drill" model `DCD791`, `t-2` "Tile saw" model `D24000`, `t-3` "Table saw" model `DWE7491`.
Customers: `ada` (Ada, maxRentals 2), `linus` (Linus, maxRentals 2), `grace` (Grace, maxRentals 2).

## Never

"library", "copy", "member", "borrow", "loan", "catalog", "book", "librarian",
and Axon's university/course/student vocabulary.
