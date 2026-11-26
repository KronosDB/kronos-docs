import { upcast } from "@kronos-ts/core"
import { ToolAdded, ToolAddedV1 } from "./events"

export const categoryAdded = upcast(ToolAddedV1, ToolAdded, (payload) => ({ ...payload, category: "uncategorised" }))
