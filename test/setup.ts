import { Kysely, PostgresDialect, sql } from 'kysely'
import { Migrator } from 'kysely/migration'
import { Pool } from 'pg'
import { migrationProvider } from '../src/migrations'
import type { Database } from '../src/types'

function resolveTestUrl(): { url: string; database: string } {
  const explicit = process.env.TEST_DATABASE_URL
  const base = explicit ?? process.env.DATABASE_URL

  if (!base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run integration tests.')
  }

  const parsed = new URL(base)

  if (!explicit) {
    const name = parsed.pathname.replace(/^\//, '') || 'clan_management'
    parsed.pathname = `/${name}_test`
  }

  return { url: parsed.toString(), database: parsed.pathname.replace(/^\//, '') }
}

async function ensureDatabase(url: string, database: string): Promise<void> {
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const pool = new Pool({ connectionString: admin.toString() })

  try {
    const existing = await pool.query('select 1 from pg_database where datname = $1', [database])
    if (existing.rows.length === 0) {
      await pool.query(`create database "${database}"`)
    }
  } finally {
    await pool.end()
  }
}

export async function createTestDb(): Promise<Kysely<Database>> {
  const { url, database } = resolveTestUrl()
  await ensureDatabase(url, database)

  const pool = new Pool({ connectionString: url })
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()

  if (error) {
    await db.destroy()
    throw error
  }

  return db
}

export async function resetTestDb(db: Kysely<Database>): Promise<void> {
  await sql`truncate table members, sections restart identity cascade`.execute(db)
}
