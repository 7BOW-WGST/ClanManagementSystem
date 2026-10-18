import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { seedDatabase } from '../src/db/seed-data'
import type { Database } from '../src/db/types'
import { addLifecycleEvent, addVeteranEvent, createMember, currentVeteran } from '../src/members/data'
import { addCorePromotionEvent, currentCoreRank, rankByName } from '../src/ranks/data'
import { addArma3SectionEvent, arma3SectionActive } from '../src/sections/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('verification: membership cycle', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  test('join → promotion → section → leave → rejoin resets derived state', async () => {
    await resetTestDb(db)
    await seedDatabase(db)

    const member = await createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })

    const sergeant = await rankByName(db, 'Sierżant')
    if (!sergeant) {
      throw new Error('rank not seeded')
    }
    await addCorePromotionEvent(db, { memberId: member, rankId: sergeant.id, eventDate: '2021-01-01', precision: 'day' })
    await addVeteranEvent(db, { memberId: member, type: 'granted', eventDate: '2021-06-01', precision: 'day' })
    await addArma3SectionEvent(db, { memberId: member, type: 'join', eventDate: '2021-03-01', precision: 'day' })

    expect((await currentCoreRank(db, member))?.name).toBe('Sierżant')
    expect(await currentVeteran(db, member)).toBe(true)
    expect(await arma3SectionActive(db, member)).toBe(true)

    // Leave: everything resets.
    await addLifecycleEvent(db, { memberId: member, type: 'leave', eventDate: '2022-01-01', precision: 'day' })
    expect(await currentCoreRank(db, member)).toBeNull()
    expect(await currentVeteran(db, member)).toBe(false)
    expect(await arma3SectionActive(db, member)).toBe(false)

    // Rejoin on the same day as the leave (same-day ordering).
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2022-01-01', precision: 'day' })
    expect((await currentCoreRank(db, member))?.name).toBe('Elew')
    expect(await currentVeteran(db, member)).toBe(false)
    expect(await arma3SectionActive(db, member)).toBe(false)
  })
})
