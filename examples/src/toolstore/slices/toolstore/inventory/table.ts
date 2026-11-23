/** One row per tool. Every write sets a value, so handling an event twice leaves the same row. */
export const createInventoryTable = `
  CREATE TABLE IF NOT EXISTS inventory (
    tool_id   text PRIMARY KEY,
    name      text NOT NULL,
    available boolean NOT NULL
  )`
