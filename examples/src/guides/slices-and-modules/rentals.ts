import { registerCustomerSlice } from "./register-customer"
import { rentToolSlice } from "./rent-tool"
import { entriesOf, type Infrastructure } from "./module"

export const rentalsModule = (infrastructure: Infrastructure) =>
  entriesOf(infrastructure, [registerCustomerSlice, rentToolSlice])
