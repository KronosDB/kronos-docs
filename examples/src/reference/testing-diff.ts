import { command, event, events, fixture, ScenarioAssertionError } from "@kronos-ts/test"
import { AddTool, ToolAdded } from "../start/messages"
import { toolStore } from "./testing-app"

const app = toolStore()

try {
  await fixture(app)
    .when(command(AddTool, { toolId: "t-1", model: "DCD791", name: "Cordless drill" }))
    .then(events(event(ToolAdded, { toolId: "t-1", model: "DCD791", name: "Drill" })))
} catch (failure) {
  if (failure instanceof ScenarioAssertionError) console.log(failure.message)
  else throw failure
}

await app.stop()
