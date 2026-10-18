import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { activeAwards, awardHistory, grantAward, listAwards, revokeAward } from '../src/awards/data'
import { seedDatabase } from '../src/db/seed-data'
import type { Database } from '../src/db/types'
import { createMember } from '../src/members/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('awards', () => {
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

  async function awardId(name: string): Promise<number> {
    const awards = await listAwards(db)
    const award = awards.find((candidate) => candidate.name === name)
    if (!award) {
      throw new Error(`Award "${name}" not seeded`)
    }
    return award.id
  }

  async function newMember(): Promise<number> {
    return createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
  }

  test('grants a repeatable award multiple times', async () => {
    await freshDb()
    const member = await newMember()
    const id = await awardId('Wojskowy Krzyż Zasługi')

    expect(await grantAward(db, { memberId: member, awardId: id, eventDate: '2021-01-01', precision: 'day', reason: 'first' })).toBeUndefined()
    expect(await grantAward(db, { memberId: member, awardId: id, eventDate: '2022-01-01', precision: 'day', reason: 'second' })).toBeUndefined()

    expect(await activeAwards(db, member)).toHaveLength(2)
  })

  test('requires a reason where configured', async () => {
    await freshDb()
    const member = await newMember()
    const id = await awardId('Złoty Krzyż Zasługi')

    expect(await grantAward(db, { memberId: member, awardId: id, eventDate: null, precision: 'unknown', reason: null })).toBeDefined()
    expect(await grantAward(db, { memberId: member, awardId: id, eventDate: null, precision: 'unknown', reason: 'valour' })).toBeUndefined()
  })

  test('a tiered grant upgrades the held lower degree', async () => {
    await freshDb()
    const member = await newMember()
    const lower = await awardId('Medal za Długoletnią Służbę - 1 Rok')
    const higher = await awardId('Medal za Długoletnią Służbę - 5 Lat')

    await grantAward(db, { memberId: member, awardId: lower, eventDate: '2021-01-01', precision: 'day', reason: null })
    expect(await grantAward(db, { memberId: member, awardId: higher, eventDate: '2022-01-01', precision: 'day', reason: null })).toBeUndefined()

    const active = await activeAwards(db, member)
    expect(active).toHaveLength(1)
    expect(active[0]?.awardId).toBe(higher)
  })

  test('revokes a specific instance and leaves others active', async () => {
    await freshDb()
    const member = await newMember()
    const id = await awardId('Wojskowy Krzyż Zasługi')
    await grantAward(db, { memberId: member, awardId: id, eventDate: '2021-01-01', precision: 'day', reason: 'a' })
    await grantAward(db, { memberId: member, awardId: id, eventDate: '2022-01-01', precision: 'day', reason: 'b' })

    const active = await activeAwards(db, member)
    expect(active).toHaveLength(2)
    const target = active[0]
    if (!target) {
      throw new Error('expected an active award')
    }

    expect(await revokeAward(db, { memberId: member, instanceEventId: target.eventId, eventDate: '2023-01-01', precision: 'day', reason: 'mistake' })).toBeUndefined()
    expect(await activeAwards(db, member)).toHaveLength(1)
    expect(await awardHistory(db, member)).toHaveLength(3)
  })
})
