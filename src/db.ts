import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { config } from './config'
import type { Database } from './types'

// Create a PostgreSQL connection pool using the validated DATABASE_URL from the config
export const pool = new Pool({ connectionString: config.databaseUrl })

// Create a Kysely instance for database operations
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
})

// Close the database connection pool when the application is shutting down (graceful shutdown)
export async function closeDb(): Promise<void> {
  await db.destroy()
}
