import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import type { Database } from '../src/db/types'
import { addLifecycleEvent, addVeteranEvent, createMember, currentVeteran } from '../src/members/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('veterans', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  async function activeMember(): Promise<number> {
    const member = await createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })
    return member
  }

  test('an active member is a veteran after a granted event', async () => {
    await resetTestDb(db)
    const member = await activeMember()

    expect(await currentVeteran(db, member)).toBe(false)
    await addVeteranEvent(db, { memberId: member, type: 'granted', eventDate: '2021-01-01', precision: 'day' })
    expect(await currentVeteran(db, member)).toBe(true)
  })

  test('a removed event ends veteran status', async () => {
    await resetTestDb(db)
    const member = await activeMember()
    await addVeteranEvent(db, { memberId: member, type: 'granted', eventDate: '2021-01-01', precision: 'day' })
    await addVeteranEvent(db, { memberId: member, type: 'removed', eventDate: '2022-01-01', precision: 'day' })

    expect(await currentVeteran(db, member)).toBe(false)
  })

  test('veteran status ends when the member leaves', async () => {
    await resetTestDb(db)
    const member = await activeMember()
    await addVeteranEvent(db, { memberId: member, type: 'granted', eventDate: '2021-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'leave', eventDate: '2022-01-01', precision: 'day' })

    expect(await currentVeteran(db, member)).toBe(false)
  })
})
