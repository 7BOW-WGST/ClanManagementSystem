import { Kysely, PostgresDialect, sql } from 'kysely'
import { Migrator } from 'kysely/migration'
import { Pool } from 'pg'
import { migrationProvider } from '../src/migrations'
import '../src/pg' // register the DATE type parser
import type { Database } from '../src/types'

// Helper functions for setting up and managing the test database
function resolveTestUrl(): { url: string; database: string } {
  const explicit = process.env.TEST_DATABASE_URL // Allow overriding the test database URL for CI or custom setups
  const base = explicit ?? process.env.DATABASE_URL // Fallback to the main database URL if TEST_DATABASE_URL is not set

  // If nothing configured
  if (!base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run integration tests.')
  }

  const parsed = new URL(base)

  // If TEST_DATABASE_URL is not explicitly set, modify the database name to use a "_test" suffix
  if (!explicit) {
    const name = parsed.pathname.replace(/^\//, '') || 'clan_management'
    parsed.pathname = `/${name}_test`
  }

  return { url: parsed.toString(), database: parsed.pathname.replace(/^\//, '') } // Full URL and database name (without leading slash)
}

// Ensure the test database exists, creating it if necessary
async function ensureDatabase(url: string, database: string): Promise<void> {
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const pool = new Pool({ connectionString: admin.toString() })

  // Create the test database if missing
  try {
    const existing = await pool.query('select 1 from pg_database where datname = $1', [database])
    if (existing.rows.length === 0) {
      await pool.query(`create database "${database}"`)
    }
  } finally {
    await pool.end()
  }
}

// Create a new Kysely instance connected to the test database, running migrations if necessary
export async function createTestDb(): Promise<Kysely<Database>> {
  const { url, database } = resolveTestUrl()
  await ensureDatabase(url, database)

  const pool = new Pool({ connectionString: url })
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()

  // If migrations fail
  if (error) {
    await db.destroy() // Clean up the Kysely instance to avoid resource leaks
    throw error
  }

  return db
}

// Between tests, reset the test database to a clean state
export async function resetTestDb(db: Kysely<Database>): Promise<void> {
  await sql`truncate table members, sections, member_nickname_events restart identity cascade`.execute(db) // Wipe + reset ids
}
