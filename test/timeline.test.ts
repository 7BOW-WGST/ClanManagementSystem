import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import type { Database } from '../src/db/types'
import {
  addLifecycleEvent,
  addNicknameEvent,
  buildTimeline,
  correctNicknameEvent,
  createMember,
  getMemberDetail,
  lifecycleWarnings,
  softDeleteNicknameEvent,
  veteranEvents,
} from '../src/members/data'
import { coreRankHistory } from '../src/ranks/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('timeline', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  test('soft-delete excludes an event from derivation', async () => {
    await resetTestDb(db)
    const id = await createMember(db, { nickname: 'Keep', eventDate: '2020-01-01', precision: 'day' })
    await addNicknameEvent(db, { memberId: id, nickname: 'Temp', eventDate: '2025-01-01', precision: 'day' })
    expect((await getMemberDetail(db, id))?.nickname).toBe('Temp')

    const detail = await getMemberDetail(db, id)
    const temp = detail?.nicknames.find((row) => row.nickname === 'Temp')
    if (!temp) {
      throw new Error('expected the Temp nickname')
    }
    await softDeleteNicknameEvent(db, temp.id)

    expect((await getMemberDetail(db, id))?.nickname).toBe('Keep')
  })

  test('correction updates a value in place', async () => {
    await resetTestDb(db)
    const id = await createMember(db, { nickname: 'Wrong', eventDate: '2020-01-01', precision: 'day' })
    const detail = await getMemberDetail(db, id)
    const event = detail?.nicknames[0]
    if (!event) {
      throw new Error('expected a nickname event')
    }

    await correctNicknameEvent(db, { eventId: event.id, nickname: 'Right', eventDate: '2020-01-01', precision: 'day' })
    expect((await getMemberDetail(db, id))?.nickname).toBe('Right')
  })

  test('a contradictory lifecycle sequence produces a warning', async () => {
    await resetTestDb(db)
    const id = await createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: id, type: 'join', eventDate: '2021-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: id, type: 'join', eventDate: '2021-02-01', precision: 'day' })

    expect((await lifecycleWarnings(db, id)).length).toBeGreaterThan(0)
  })

  test('the timeline merges core streams chronologically', async () => {
    await resetTestDb(db)
    const id = await createMember(db, { nickname: 'A', eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: id, type: 'join', eventDate: '2020-02-01', precision: 'day' })

    const detail = await getMemberDetail(db, id)
    const timeline = buildTimeline({
      nicknames: detail?.nicknames ?? [],
      lifecycle: detail?.lifecycle ?? [],
      ranks: await coreRankHistory(db, id),
      veterans: await veteranEvents(db, id),
    })

    expect(timeline).toHaveLength(2)
    expect(timeline[0]?.kind).toBe('nickname')
    expect(timeline[1]?.kind).toBe('lifecycle')
  })
})
