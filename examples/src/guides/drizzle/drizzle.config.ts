import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/guides/drizzle/inventory/schema.ts",
  out: "./src/guides/drizzle/migrations",
})
