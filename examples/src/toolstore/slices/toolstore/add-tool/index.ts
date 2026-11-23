import { handle } from "./handler"

export const addTool = () => ({ commandHandlers: [handle], queryHandlers: [], eventHandlers: [] })
