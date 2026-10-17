import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import {
  activeLinksForAccount,
  addAccountNameEvent,
  changeRelation,
  createAccount,
  getAccountDetail,
  linkAccount,
  listAccounts,
  memberAccountViews,
  platformIdTaken,
  unlinkAccount,
} from '../src/accounts/data'
import type { Database, Platform, Relation } from '../src/db/types'
import { createMember } from '../src/members/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('accounts', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  // Create a member for link tests.
  async function newMember(nickname: string): Promise<number> {
    return createMember(db, { nickname, eventDate: '2020-01-01', precision: 'day' })
  }

  // Create a bare account for link tests.
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

  // Link helper with sensible defaults.
  function link(accountId: number, memberId: number, relation: Relation | null) {
    return linkAccount(db, { accountId, memberId, relation, eventDate: null, precision: 'unknown' })
  }

  test('creates an account with an optional display name and derives it', async () => {
    await resetTestDb(db)
    const id = await createAccount(db, {
      platform: 'steam',
      platformId: '76561198000000000',
      name: 'Airman',
      nameDate: '2020-01-01',
      namePrecision: 'day',
      createdDate: null,
      createdPrecision: null,
    })

    const accounts = await listAccounts(db)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.platform).toBe('steam')
    expect(accounts[0]?.name).toBe('Airman')

    const detail = await getAccountDetail(db, id)
    expect(detail?.platform_id).toBe('76561198000000000')
  })

  test('the latest name derives as current', async () => {
    await resetTestDb(db)
    const id = await newAccount('discord', null)
    await addAccountNameEvent(db, { accountId: id, name: 'Old', eventDate: '2020-01-01', precision: 'day' })
    await addAccountNameEvent(db, { accountId: id, name: 'New', eventDate: '2025-01-01', precision: 'day' })

    const detail = await getAccountDetail(db, id)
    expect(detail?.name).toBe('New')
    expect(detail?.names).toHaveLength(2)
  })

  test('detects a duplicate (platform, platform_id)', async () => {
    await resetTestDb(db)
    await newAccount('arma3units', 'abc')

    expect(await platformIdTaken(db, 'arma3units', 'abc')).toBe(true)
    expect(await platformIdTaken(db, 'arma3units', 'xyz')).toBe(false)
  })

  test('returns undefined for a missing account', async () => {
    await resetTestDb(db)
    expect(await getAccountDetail(db, 999)).toBeUndefined()
  })

  test('links a War Thunder account and enforces one main/alt per account', async () => {
    await resetTestDb(db)
    const account = await newAccount('warthunder', 'wt-1')
    const a = await newMember('A')
    const b = await newMember('B')

    expect(await link(account, a, 'main')).toBeUndefined()
    expect(await link(account, b, 'alt')).toBeDefined()
    expect(await link(account, a, 'main')).toBeDefined() // duplicate link
  })

  test('enforces one main account per member', async () => {
    await resetTestDb(db)
    const first = await newAccount('warthunder', 'wt-2')
    const second = await newAccount('warthunder', 'wt-3')
    const member = await newMember('A')

    expect(await link(first, member, 'main')).toBeUndefined()
    expect(await link(second, member, 'main')).toBeDefined()
  })

  test('a non-War Thunder account links to a single member', async () => {
    await resetTestDb(db)
    const account = await newAccount('discord', 'discord-1')
    const a = await newMember('A')
    const b = await newMember('B')

    expect(await link(account, a, null)).toBeUndefined()
    expect(await link(account, b, null)).toBeDefined()
  })

  test('allows multiple borrowed links and unlinks one', async () => {
    await resetTestDb(db)
    const account = await newAccount('warthunder', 'wt-4')
    const a = await newMember('A')
    const b = await newMember('B')

    await link(account, a, 'borrowed')
    await link(account, b, 'borrowed')
    expect(await activeLinksForAccount(db, account)).toHaveLength(2)

    await unlinkAccount(db, { accountId: account, memberId: a, eventDate: null, precision: 'unknown' })
    const remaining = await activeLinksForAccount(db, account)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.memberId).toBe(b)

    const views = await memberAccountViews(db, a)
    expect(views).toHaveLength(0)
  })

  test('changes the relation of an active link', async () => {
    await resetTestDb(db)
    const account = await newAccount('warthunder', 'wt-5')
    const member = await newMember('A')

    await link(account, member, 'borrowed')
    expect(await changeRelation(db, { accountId: account, memberId: member, relation: 'main', eventDate: null, precision: 'unknown' })).toBeUndefined()

    const links = await activeLinksForAccount(db, account)
    expect(links[0]?.relation).toBe('main')
  })
})
