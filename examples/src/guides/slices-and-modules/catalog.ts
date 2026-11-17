import { addToolSlice } from "./add-tool"
import { inventorySlice } from "./inventory"
import { entriesOf, type Infrastructure } from "./module"

export const catalogModule = (infrastructure: Infrastructure) =>
  entriesOf(infrastructure, [addToolSlice, inventorySlice])
