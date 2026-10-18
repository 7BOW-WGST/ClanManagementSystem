import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { seedDatabase } from '../src/db/seed-data'
import type { Database } from '../src/db/types'
import { addLifecycleEvent, createMember } from '../src/members/data'
import { addArma3PromotionEvent, currentArma3Rank, rankByName } from '../src/ranks/data'
import { addArma3SectionEvent, arma3SectionActive } from '../src/sections/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('arma3', () => {
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

  async function activeMember(): Promise<number> {
    const member = await createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })
    return member
  }

  async function rankId(name: string): Promise<number> {
    const rank = await rankByName(db, name)
    if (!rank) {
      throw new Error(`Rank "${name}" not seeded`)
    }
    return rank.id
  }

  test('section membership derives from join/leave', async () => {
    await freshDb()
    const member = await activeMember()
    expect(await arma3SectionActive(db, member)).toBe(false)

    await addArma3SectionEvent(db, { memberId: member, type: 'join', eventDate: '2021-01-01', precision: 'day' })
    expect(await arma3SectionActive(db, member)).toBe(true)

    await addArma3SectionEvent(db, { memberId: member, type: 'leave', eventDate: '2022-01-01', precision: 'day' })
    expect(await arma3SectionActive(db, member)).toBe(false)
  })

  test('the default Arma 3 rank is Elew and promotions override it', async () => {
    await freshDb()
    const member = await activeMember()
    await addArma3SectionEvent(db, { memberId: member, type: 'join', eventDate: '2021-01-01', precision: 'day' })

    expect((await currentArma3Rank(db, member))?.name).toBe('Elew')

    await addArma3PromotionEvent(db, { memberId: member, rankId: await rankId('Szeregowy'), eventDate: '2021-02-01', precision: 'day', reason: null })
    expect((await currentArma3Rank(db, member))?.name).toBe('Szeregowy')
  })

  test('leaving the clan ends Arma 3 section activity', async () => {
    await freshDb()
    const member = await activeMember()
    await addArma3SectionEvent(db, { memberId: member, type: 'join', eventDate: '2021-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'leave', eventDate: '2022-01-01', precision: 'day' })

    expect(await arma3SectionActive(db, member)).toBe(false)
  })
})
