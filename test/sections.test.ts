import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { createAccount, linkAccount } from '../src/accounts/data'
import type { Database, Platform, Relation } from '../src/db/types'
import { createMember, addLifecycleEvent } from '../src/members/data'
import { addSquadronEvent, currentSquadronForAccount, memberWarThunder } from '../src/sections/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('sections', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  async function newMember(nickname: string): Promise<number> {
    const member = await createMember(db, { nickname, eventDate: '2020-01-01', precision: 'day' })
    await addLifecycleEvent(db, { memberId: member, type: 'join', eventDate: '2020-01-01', precision: 'day' })
    return member
  }

  async function newAccount(platform: Platform, platformId: string | null): Promise<number> {
    return createAccount(db, {
      platform,
      platformId,
      name: null,
      nameDate: null,
      namePrecision: 'unknown',
      createdDate: null,
      createdPrecision: null,
    })
  }

  function link(accountId: number, memberId: number, relation: Relation | null) {
    return linkAccount(db, { accountId, memberId, relation, eventDate: null, precision: 'unknown' })
  }

  test('derives War Thunder membership from a main account squadron event', async () => {
    await resetTestDb(db)
    const member = await newMember('A')
    const account = await newAccount('warthunder', 'wt-1')
    await link(account, member, 'main')
    await addSquadronEvent(db, { accountId: account, squadron: '7BOW', type: 'join', eventDate: '2021-01-01', precision: 'day' })

    expect((await memberWarThunder(db, member)).squadron).toBe('7BOW')
  })

  test('a borrowed account does not grant membership', async () => {
    await resetTestDb(db)
    const owner = await newMember('Owner')
    const borrower = await newMember('Borrower')
    const account = await newAccount('warthunder', 'wt-2')
    await link(account, owner, 'main')
    await link(account, borrower, 'borrowed')
    await addSquadronEvent(db, { accountId: account, squadron: '7BOW', type: 'join', eventDate: '2021-01-01', precision: 'day' })

    expect((await memberWarThunder(db, borrower)).squadron).toBeNull()
    expect((await memberWarThunder(db, owner)).squadron).toBe('7BOW')
  })

  test('a leave event clears the current squadron', async () => {
    await resetTestDb(db)
    const account = await newAccount('warthunder', 'wt-3')
    await addSquadronEvent(db, { accountId: account, squadron: '7BOW', type: 'join', eventDate: '2021-01-01', precision: 'day' })
    expect(await currentSquadronForAccount(db, account)).toBe('7BOW')

    await addSquadronEvent(db, { accountId: account, squadron: '7BOW', type: 'leave', eventDate: '2022-01-01', precision: 'day' })
    expect(await currentSquadronForAccount(db, account)).toBeNull()
  })

  test('flags a conflict when accounts disagree', async () => {
    await resetTestDb(db)
    const member = await newMember('A')
    const first = await newAccount('warthunder', 'wt-4')
    const second = await newAccount('warthunder', 'wt-5')
    await link(first, member, 'main')
    await link(second, member, 'alt')
    await addSquadronEvent(db, { accountId: first, squadron: '7BOW', type: 'join', eventDate: '2021-01-01', precision: 'day' })
    await addSquadronEvent(db, { accountId: second, squadron: '7BOWs', type: 'join', eventDate: '2021-02-01', precision: 'day' })

    const result = await memberWarThunder(db, member)
    expect(result.conflict).toBe(true)
    expect(result.squadron).toBe('7BOWs')
  })
})
