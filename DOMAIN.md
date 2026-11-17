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
| `AddTool` | toolId, model, name | `ToolAdded` | toolId |
| `RegisterCustomer` | customerId, name, maxRentals | `CustomerRegistered` | customerId |
| `RentTool` | toolId, customerId → result `RentOutcome`: `{ rented: true }` or `{ rented: false, reason: "tool-unavailable" \| "customer-unknown" \| "over-limit" }` | `ToolRented` | toolId, customerId |
| `ReturnTool` | toolId, customerId | `ToolReturned` | toolId, customerId |
| (scheduled) | toolId, customerId | `RentalOverdue` | toolId, customerId |
| `SuspendCustomer` | customerId, reason | `CustomerSuspended` | customerId |

Queries: `GetInventory` (rows: toolId, name, available) · `GetCustomerRentals` (customerId → toolIds).

## States

| State | Id | Shape |
| --- | --- | --- |
| `Tool` | toolId | exists |
| `Customer` | customerId | registered |
| `Renting` | toolId, customerId | toolId, toolAvailable, customerRegistered, rentals, maxRentals |
| `Rental` | toolId | heldBy |
| `Suspension` | customerId | suspended |

Processor names: `inventory-view`, `rental-deadlines`, `customer-rentals`.

## Rules

A customer may rent a tool when the tool is available, the customer is
registered and not suspended, and the customer is under their rental limit. A
rented tool is due back in seven days; if it is not returned in time the
customer is suspended until staff lift the suspension.

## Refusals

A business refusal the caller acts on is a command result (`RentTool`). A throw
is for bugs, broken invariants and infrastructure (duplicate tool id, append
conflict). Tests assert results with `result(...)`, not `error(...)`.

## Sample data

Tools: `t-1` "Cordless drill" model `DCD791`, `t-2` "Tile saw" model `D24000`, `t-3` "Table saw" model `DWE7491`.
Customers: `ada` (Ada, maxRentals 2), `linus` (Linus, maxRentals 2), `grace` (Grace, maxRentals 2).

## Never

"library", "copy", "member", "borrow", "loan", "catalog", "book", "librarian",
and Axon's university/course/student vocabulary.
