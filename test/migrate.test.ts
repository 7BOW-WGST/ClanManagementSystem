import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { seedDatabase } from '../src/seed-data'
import type { Database } from '../src/types'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('migrations and seed', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  test('the schema is migrated', async () => {
    const tables = await db.introspection.getTables()
    const names = tables.map((table) => table.name)

    expect(names).toContain('members')
    expect(names).toContain('sections')
  })

  test('seed is idempotent', async () => {
    await resetTestDb(db)
    await seedDatabase(db)
    await seedDatabase(db)

    const rows = await db.selectFrom('sections').select('name').orderBy('name').execute()

    expect(rows.map((row) => row.name)).toEqual(['arma3', 'multigaming', 'warthunder'])
  })
})
