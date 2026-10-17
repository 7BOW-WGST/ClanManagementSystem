import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { getConfig } from '../config'
import './pg'
import type { Database } from './types'

let pool: Pool | undefined
let client: Kysely<Database> | undefined

// Create the connection pool + Kysely client lazily, on first use. This keeps the app
// importable without a database (tests) while still validating config when it is actually used.
export function getDb(): Kysely<Database> {
  if (!client) {
    pool = new Pool({ connectionString: getConfig().databaseUrl })
    client = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  }
  return client
}

// Close the database connection pool when the application is shutting down (graceful shutdown).
export async function closeDb(): Promise<void> {
  if (client) {
    await client.destroy()
    client = undefined
    pool = undefined
  }
}
