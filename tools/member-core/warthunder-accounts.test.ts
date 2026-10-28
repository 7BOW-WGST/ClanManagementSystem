import { describe, expect, test } from 'bun:test'
import { openMemberDatabase } from './db'
import { importWarthunderAccounts, parseWarthunderAccounts } from './warthunder-accounts'

interface WtRow {
  wt_id: string
  member_id: number | null
  username: string
  ownership_type: string
  squadron: string | null
  squadron_role: string | null
  squadron_joined_at: string | null
}

function addMember(
  db: ReturnType<typeof openMemberDatabase>,
  memberId: number,
  nickname: string,
): void {
  db.run('INSERT INTO members (member_id, nickname, joined_at) VALUES (?, ?, ?)', [
    memberId,
    nickname,
    '2020-01-01T00:00:00.000Z',
  ])
}

function addDiscordAccount(
  db: ReturnType<typeof openMemberDatabase>,
  discordId: string,
  memberId: number,
  names: { username: string; globalName?: string | null; serverName?: string | null },
): void {
  db.run(
    `INSERT INTO discord_accounts (
       discord_id, member_id, username, global_name, server_name, joined_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      discordId,
      memberId,
      names.username,
      names.globalName ?? null,
      names.serverName ?? null,
      '2020-01-01T00:00:00.000Z',
    ],
  )
}

function account(wtId: string, username: string): Record<string, unknown> {
  return {
    wt_id: wtId,
    username,
    squadron: '7BOW',
    squadron_role: 'Private',
    squadron_joined_at: '2020-04-28T00:00:00.000Z',
  }
}

function rows(db: ReturnType<typeof openMemberDatabase>): WtRow[] {
  return db
    .query<WtRow, []>(
      `SELECT wt_id, member_id, username, ownership_type, squadron, squadron_role, squadron_joined_at
       FROM warthunder_accounts
       ORDER BY wt_id`,
    )
    .all()
}

describe('parseWarthunderAccounts', () => {
  test('validates required fields and normalizes timestamps', () => {
    const accounts = parseWarthunderAccounts({
      accounts: [
        {
          wt_id: '101',
          username: 'Alpha',
          squadron: '7BOW',
          squadron_role: 'Commander',
          squadron_joined_at: '2020-04-28T00:00:00.000000+00:00',
        },
      ],
    })

    expect(accounts).toEqual([
      {
        wt_id: '101',
        username: 'Alpha',
        squadron: '7BOW',
        squadron_role: 'Commander',
        squadron_joined_at: '2020-04-28T00:00:00.000Z',
      },
    ])
  })

  test('rejects duplicate IDs, non-numeric IDs, and invalid squadrons', () => {
    expect(() =>
      parseWarthunderAccounts({
        accounts: [account('101', 'A'), account('101', 'B')],
      }),
    ).toThrow('Duplicate wt_id')

    expect(() =>
      parseWarthunderAccounts({ accounts: [account('abc', 'A')] }),
    ).toThrow('numeric string')

    expect(() =>
      parseWarthunderAccounts({
        accounts: [{ ...account('101', 'A'), squadron: 'OTHER' }],
      }),
    ).toThrow('squadron')
  })
})

describe('importWarthunderAccounts', () => {
  test('links exact, case-insensitive, and Discord-name matches; leaves mismatches nullable', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addMember(db, 2, 'Beta')
      addMember(db, 3, 'CaseName')
      addMember(db, 4, 'Dup')
      addMember(db, 5, 'Dup')
      addDiscordAccount(db, 'd2', 2, {
        username: 'beta_discord',
        serverName: 'BetaWT',
      })

      const result = importWarthunderAccounts(
        db,
        {
          accounts: [
            account('101', 'Alpha'),
            account('102', 'betawt'),
            account('103', 'casename'),
            account('104', 'Dup'),
            account('105', 'Nobody'),
          ],
        },
        { dryRun: false },
      )

      expect(result).toEqual({
        processed: 5,
        inserted: 5,
        updated: 0,
        linked: 3,
        unlinked: 2,
        ambiguous: 1,
        dryRun: false,
        unlinkedAccounts: [
          { wt_id: '104', username: 'Dup', reason: 'ambiguous' },
          { wt_id: '105', username: 'Nobody', reason: 'no_match' },
        ],
      })

      expect(rows(db)).toEqual([
        {
          wt_id: '101',
          member_id: 1,
          username: 'Alpha',
          ownership_type: 'main',
          squadron: '7BOW',
          squadron_role: 'Private',
          squadron_joined_at: '2020-04-28T00:00:00.000Z',
        },
        {
          wt_id: '102',
          member_id: 2,
          username: 'betawt',
          ownership_type: 'main',
          squadron: '7BOW',
          squadron_role: 'Private',
          squadron_joined_at: '2020-04-28T00:00:00.000Z',
        },
        {
          wt_id: '103',
          member_id: 3,
          username: 'casename',
          ownership_type: 'main',
          squadron: '7BOW',
          squadron_role: 'Private',
          squadron_joined_at: '2020-04-28T00:00:00.000Z',
        },
        {
          wt_id: '104',
          member_id: null,
          username: 'Dup',
          ownership_type: 'main',
          squadron: '7BOW',
          squadron_role: 'Private',
          squadron_joined_at: '2020-04-28T00:00:00.000Z',
        },
        {
          wt_id: '105',
          member_id: null,
          username: 'Nobody',
          ownership_type: 'main',
          squadron: '7BOW',
          squadron_role: 'Private',
          squadron_joined_at: '2020-04-28T00:00:00.000Z',
        },
      ])
      expect(db.query<Record<string, unknown>, []>('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  test('preserves manual links/ownership and fills a previously unlinked account', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addMember(db, 2, 'ManualTarget')

      importWarthunderAccounts(
        db,
        { accounts: [account('101', 'Alpha'), account('105', 'Nobody')] },
        { dryRun: false },
      )

      db.run(
        `UPDATE warthunder_accounts
         SET member_id = 2, ownership_type = 'alt'
         WHERE wt_id = '101'`,
      )

      addMember(db, 6, 'Nobody')

      const result = importWarthunderAccounts(
        db,
        {
          accounts: [
            { ...account('101', 'Alpha'), squadron_role: 'Officer' },
            account('105', 'Nobody'),
          ],
        },
        { dryRun: false },
      )

      expect(result.inserted).toBe(0)
      expect(result.updated).toBe(2)
      expect(result.linked).toBe(2)
      expect(result.unlinked).toBe(0)

      const stored = rows(db)
      expect(stored[0]).toEqual({
        wt_id: '101',
        member_id: 2,
        username: 'Alpha',
        ownership_type: 'alt',
        squadron: '7BOW',
        squadron_role: 'Officer',
        squadron_joined_at: '2020-04-28T00:00:00.000Z',
      })
      expect(stored[1]?.member_id).toBe(6)
    } finally {
      db.close()
    }
  })

  test('dry run validates without writing', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      const result = importWarthunderAccounts(
        db,
        { accounts: [account('101', 'Alpha')] },
        { dryRun: true },
      )

      expect(result.processed).toBe(1)
      expect(result.inserted).toBe(1)
      expect(rows(db)).toEqual([])
    } finally {
      db.close()
    }
  })
})
