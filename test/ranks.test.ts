import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { seedDatabase } from '../src/db/seed-data'
import type { Database } from '../src/db/types'
import { addLifecycleEvent, createMember } from '../src/members/data'
import { addCorePromotionEvent, currentCoreRank, rankByName } from '../src/ranks/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('ranks', () => {
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
    await seedDatabase(db) // ensure the rank catalog is present after the truncate
  }

  async function newMember(): Promise<number> {
    return createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
  }

  async function rankId(name: string): Promise<number> {
    const rank = await rankByName(db, name)
    if (!rank) {
      throw new Error(`Rank "${name}" not seeded`)
    }
    return rank.id
  }

  test('an active member with no promotions is Elew', async () => {
    await freshDb()
    const member = await newMember()
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })

    expect((await currentCoreRank(db, member))?.name).toBe('Elew')
  })

  test('a promotion overrides the entry rank and may skip ranks', async () => {
    await freshDb()
    const member = await newMember()
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })
    await addCorePromotionEvent(db, {
      memberId: member,
      rankId: await rankId('Sierżant'),
      eventDate: '2021-01-01',
      precision: 'day',
      reason: null,
    })

    expect((await currentCoreRank(db, member))?.name).toBe('Sierżant')
  })

  test('a demotion becomes the current rank', async () => {
    await freshDb()
    const member = await newMember()
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })
    await addCorePromotionEvent(db, { memberId: member, rankId: await rankId('Sierżant'), eventDate: '2021-01-01', precision: 'day', reason: null })
    await addCorePromotionEvent(db, { memberId: member, rankId: await rankId('Kapral'), eventDate: '2022-01-01', precision: 'day', reason: 'demotion' })

    expect((await currentCoreRank(db, member))?.name).toBe('Kapral')
  })

  test('a member who is not active has no core rank', async () => {
    await freshDb()
    const member = await newMember()

    expect(await currentCoreRank(db, member)).toBeNull()
  })
})
