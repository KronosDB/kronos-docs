import { handle } from "./handler"

export const rentTool = () => ({ commandHandlers: [handle], queryHandlers: [], eventHandlers: [] })
