import { handle } from "./handler"

export const registerCustomer = () => ({ commandHandlers: [handle], queryHandlers: [], eventHandlers: [] })
