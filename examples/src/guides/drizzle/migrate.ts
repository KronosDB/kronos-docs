import { drizzle } from "drizzle-orm/node-postgres"
import { migrate as apply } from "drizzle-orm/node-postgres/migrator"

const migrationsFolder = new URL("./migrations", import.meta.url).pathname

/** Applies the migrations drizzle-kit generated from the slices' schemas. One already applied is skipped. */
export const migrate = async (databaseUrl: string) => {
  const migrator = drizzle(databaseUrl)
  await apply(migrator, { migrationsFolder })
  await migrator.$client.end()
}
