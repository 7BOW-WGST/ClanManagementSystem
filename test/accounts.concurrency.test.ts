import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import {
  activeLinksForAccount,
  addAccountNameEvent,
  createAccount,
  getAccountDetail,
  linkAccount,
  mergeAccounts,
} from '../src/accounts/data'
import type { Database, Platform, Relation } from '../src/db/types'
import { createMember } from '../src/members/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

// Link/merge operations must serialize concurrent edits and reject the losing write.
describe.skipIf(!dbConfigured)('account constraints under concurrency', () => {
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
    return createMember(db, { nickname, eventDate: '2020-01-01', precision: 'day' })
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

  test('serializes concurrent main links on the same account', async () => {
    await resetTestDb(db)
    const account = await newAccount('warthunder', 'concurrent-1')
    const firstMember = await newMember('A')
    const secondMember = await newMember('B')

    const results = await Promise.all([link(account, firstMember, 'main'), link(account, secondMember, 'main')])

    expect(results.filter((result) => result !== undefined)).toHaveLength(1)
    expect(await activeLinksForAccount(db, account)).toHaveLength(1)
  })

  test('serializes concurrent main links for the same member', async () => {
    await resetTestDb(db)
    const firstAccount = await newAccount('warthunder', 'concurrent-2')
    const secondAccount = await newAccount('warthunder', 'concurrent-3')
    const member = await newMember('A')

    const results = await Promise.all([link(firstAccount, member, 'main'), link(secondAccount, member, 'main')])

    expect(results.filter((result) => result !== undefined)).toHaveLength(1)
  })

  test('serializes concurrent member links on a non-War Thunder account', async () => {
    await resetTestDb(db)
    const account = await newAccount('discord', 'concurrent-4')
    const firstMember = await newMember('A')
    const secondMember = await newMember('B')

    const results = await Promise.all([link(account, firstMember, null), link(account, secondMember, null)])

    expect(results.filter((result) => result !== undefined)).toHaveLength(1)
    expect(await activeLinksForAccount(db, account)).toHaveLength(1)
  })

  test('merges accounts with a colliding link and preserves history', async () => {
    await resetTestDb(db)
    const canonical = await newAccount('warthunder', 'collide-1')
    const duplicate = await newAccount('warthunder', 'collide-2')
    const member = await newMember('A')
    await addAccountNameEvent(db, { accountId: canonical, name: 'Primary', eventDate: '2020-01-01', precision: 'day' })
    await addAccountNameEvent(db, { accountId: duplicate, name: 'Duplicate', eventDate: '2021-01-01', precision: 'day' })

    await link(canonical, member, 'borrowed')
    await link(duplicate, member, 'borrowed')

    expect(await mergeAccounts(db, { canonicalId: canonical, duplicateId: duplicate, reason: 'collision' })).toBeUndefined()

    // The two same-member links collapse into one stream: history minus the retired duplicate.
    const links = await activeLinksForAccount(db, canonical)
    expect(links).toHaveLength(1)
    expect(links[0]?.memberId).toBe(member)
    expect((await getAccountDetail(db, canonical))?.names).toHaveLength(2)
  })
})
