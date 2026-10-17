import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { addNicknameEvent, createMember, listMembers } from '../src/members'
import type { Database } from '../src/types'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('members', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  test('creates a member with an optional nickname and derives it', async () => {
    await resetTestDb(db)
    await createMember(db, { nickname: 'Kamil', eventDate: '2020-01-01', precision: 'day' })

    const members = await listMembers(db)
    expect(members).toHaveLength(1)
    expect(members[0]?.nickname).toBe('Kamil')
    expect(members[0]?.status).toBe('unknown')
  })

  test('the latest nickname derives as current', async () => {
    await resetTestDb(db)
    const id = await createMember(db, { nickname: 'Old', eventDate: '2020-01-01', precision: 'day' })
    await addNicknameEvent(db, { memberId: id, nickname: 'New', eventDate: '2025-01-01', precision: 'day' })

    const members = await listMembers(db)
    expect(members[0]?.nickname).toBe('New')
  })
})
