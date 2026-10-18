import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Kysely } from 'kysely'
import { createAccount } from '../src/accounts/data'
import type { Database, Platform } from '../src/db/types'
import { addGroupEvent, currentGroupMembership, isGroupPlatform } from '../src/groups/data'
import { createTestDb, resetTestDb } from './setup'

const dbConfigured = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)

describe.skipIf(!dbConfigured)('groups', () => {
  let db: Kysely<Database>

  beforeAll(async () => {
    db = await createTestDb()
  })

  afterAll(async () => {
    if (db) {
      await db.destroy()
    }
  })

  async function newAccount(platform: Platform, platformId: string): Promise<number> {
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

  test('Discord group membership derives from join/leave', async () => {
    await resetTestDb(db)
    const account = await newAccount('discord', 'discord-1')

    await addGroupEvent(db, { accountId: account, platform: 'discord', type: 'join', eventDate: '2021-01-01', precision: 'day' })
    expect(await currentGroupMembership(db, account, 'discord')).toBe(true)

    await addGroupEvent(db, { accountId: account, platform: 'discord', type: 'leave', eventDate: '2022-01-01', precision: 'day' })
    expect(await currentGroupMembership(db, account, 'discord')).toBe(false)
  })

  test('Steam group membership derives from a join', async () => {
    await resetTestDb(db)
    const account = await newAccount('steam', '76561198000000001')

    await addGroupEvent(db, { accountId: account, platform: 'steam', type: 'join', eventDate: '2021-01-01', precision: 'day' })
    expect(await currentGroupMembership(db, account, 'steam')).toBe(true)
  })

  test('only Discord and Steam have a group stream', () => {
    expect(isGroupPlatform('discord')).toBe(true)
    expect(isGroupPlatform('steam')).toBe(true)
    expect(isGroupPlatform('warthunder')).toBe(false)
    expect(isGroupPlatform('arma3units')).toBe(false)
  })
})
