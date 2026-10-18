import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { seedDatabase } from '../src/db/seed-data'
import type { Database } from '../src/db/types'
import { createMember } from '../src/members/data'
import { addSuspension, listSections, suspensionViews } from '../src/sections/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('suspensions', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  async function freshDb(): Promise<void> {
    await resetTestDb(db)
    await seedDatabase(db)
  }

  async function newMember(): Promise<number> {
    return createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
  }

  async function sectionId(name: string): Promise<number> {
    const sections = await listSections(db)
    const section = sections.find((candidate) => candidate.name === name)
    if (!section) {
      throw new Error(`Section "${name}" not seeded`)
    }
    return section.id
  }

  test('blocks an overlapping suspension for the same section', async () => {
    await freshDb()
    const member = await newMember()
    const section = await sectionId('warthunder')

    expect(
      await addSuspension(db, { memberId: member, sectionId: section, startDate: '2021-01-01', startPrecision: 'day', endDate: '2021-06-01', endPrecision: 'day', reason: 'first' }),
    ).toBeUndefined()
    expect(
      await addSuspension(db, { memberId: member, sectionId: section, startDate: '2021-03-01', startPrecision: 'day', endDate: '2021-07-01', endPrecision: 'day', reason: 'overlap' }),
    ).toBeDefined()
  })

  test('allows an adjacent (non-overlapping) suspension', async () => {
    await freshDb()
    const member = await newMember()
    const section = await sectionId('warthunder')

    await addSuspension(db, { memberId: member, sectionId: section, startDate: '2021-01-01', startPrecision: 'day', endDate: '2021-06-01', endPrecision: 'day', reason: 'first' })
    expect(
      await addSuspension(db, { memberId: member, sectionId: section, startDate: '2021-06-01', startPrecision: 'day', endDate: '2021-12-01', endPrecision: 'day', reason: 'second' }),
    ).toBeUndefined()
  })

  test('derives an ongoing suspension as active', async () => {
    await freshDb()
    const member = await newMember()
    const section = await sectionId('arma3')

    await addSuspension(db, { memberId: member, sectionId: section, startDate: '2000-01-01', startPrecision: 'day', endDate: null, endPrecision: null, reason: 'ongoing' })

    const views = await suspensionViews(db, member)
    expect(views).toHaveLength(1)
    expect(views[0]?.active).toBe(true)
  })
})
