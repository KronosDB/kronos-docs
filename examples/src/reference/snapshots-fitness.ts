import { matchesInitialStructure } from "@kronos-ts/core"

const initial = { rented: 0, returned: 0, toolIds: [] as string[] }

// A cached value from before `returned` was added to the fold.
console.log(matchesInitialStructure(initial, { rented: 3, toolIds: ["t-1"] }))

// Extra keys are ignored, so a removed field does not invalidate the entry.
console.log(matchesInitialStructure(initial, { rented: 3, returned: 1, toolIds: [], legacy: true }))

// A field that came back with another type does not match.
console.log(matchesInitialStructure(initial, { rented: "3", returned: 1, toolIds: [] }))
