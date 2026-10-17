import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { addAccountNameEvent, createAccount, getAccountDetail, listAccounts, platformIdTaken } from '../src/accounts/data'
import type { Database } from '../src/db/types'
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
    const id = await createAccount(db, {
      platform: 'discord',
      platformId: null,
      name: 'Old',
      nameDate: '2020-01-01',
      namePrecision: 'day',
      createdDate: null,
      createdPrecision: null,
    })
    await addAccountNameEvent(db, { accountId: id, name: 'New', eventDate: '2025-01-01', precision: 'day' })

    const detail = await getAccountDetail(db, id)
    expect(detail?.name).toBe('New')
    expect(detail?.names).toHaveLength(2)
  })

  test('detects a duplicate (platform, platform_id)', async () => {
    await resetTestDb(db)
    await createAccount(db, {
      platform: 'arma3units',
      platformId: 'abc',
      name: null,
      nameDate: null,
      namePrecision: 'unknown',
      createdDate: null,
      createdPrecision: null,
    })

    expect(await platformIdTaken(db, 'arma3units', 'abc')).toBe(true)
    expect(await platformIdTaken(db, 'arma3units', 'xyz')).toBe(false)
  })

  test('returns undefined for a missing account', async () => {
    await resetTestDb(db)
    expect(await getAccountDetail(db, 999)).toBeUndefined()
  })
})
