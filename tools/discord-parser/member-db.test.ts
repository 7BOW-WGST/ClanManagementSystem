import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  exportMembers,
  nicknameFor,
  openMemberDatabase,
  parseRoster,
  toIsoTimestamp,
} from './member-db'
import type { RosterMember } from './types'

function member(
  input: Partial<RosterMember> & Pick<RosterMember, 'discord_id' | 'username'>,
): RosterMember {
  return {
    global_name: null,
    server_name: null,
    joined_at: '2020-01-01T00:00:00.000000+00:00',
    matched_role_ids: [],
    ...input,
  }
}

interface MemberRow {
  member_id: number
  nickname: string
  joined_at: string | null
}

interface AccountRow {
  discord_id: string
  member_id: number
  username: string
  global_name: string | null
  server_name: string | null
  joined_at: string | null
}

function idMap(db: ReturnType<typeof openMemberDatabase>): Map<string, number> {
  const rows = db
    .query<{ discord_id: string; member_id: number }, []>(
      'SELECT discord_id, member_id FROM discord_accounts',
    )
    .all()
  return new Map(rows.map((row) => [row.discord_id, row.member_id]))
}

describe('nicknameFor', () => {
  test('prefers server name, then global name, then username', () => {
    expect(
      nicknameFor(
        member({
          discord_id: '1',
          username: 'account',
          global_name: 'Global',
          server_name: 'Server',
        }),
      ),
    ).toBe('Server')
    expect(
      nicknameFor(
        member({ discord_id: '2', username: 'account', global_name: 'Global' }),
      ),
    ).toBe('Global')
    expect(nicknameFor(member({ discord_id: '3', username: 'account' }))).toBe('account')
  })
})

describe('toIsoTimestamp', () => {
  test('normalizes timestamps to ISO 8601 UTC', () => {
    expect(toIsoTimestamp('2020-05-06T22:30:00.000000+00:00')).toBe(
      '2020-05-06T22:30:00.000Z',
    )
    expect(toIsoTimestamp('2020-01-01T00:00:00.000000+00:00')).toBe(
      '2020-01-01T00:00:00.000Z',
    )
    expect(toIsoTimestamp(null)).toBeNull()
  })

  test('rejects invalid timestamps', () => {
    expect(() => toIsoTimestamp('not-a-date')).toThrow('Invalid joined_at timestamp')
  })
})

describe('parseRoster', () => {
  test('validates members and exposes the expected count', () => {
    const parsed = parseRoster({
      meta: { kept_count: 1 },
      members: [
        {
          discord_id: '1',
          username: 'account',
          global_name: null,
          server_name: null,
          joined_at: null,
          matched_role_ids: [],
        },
      ],
    })

    expect(parsed.keptCount).toBe(1)
    expect(parsed.members).toHaveLength(1)
    expect(parsed.members[0]?.discord_id).toBe('1')
  })

  test('rejects duplicate Discord IDs', () => {
    expect(() =>
      parseRoster({
        members: [
          { discord_id: '1', username: 'one' },
          { discord_id: '1', username: 'two' },
        ],
      }),
    ).toThrow('Duplicate discord_id')
  })

  test('rejects malformed members', () => {
    expect(() =>
      parseRoster({
        members: [{ discord_id: '1' }],
      }),
    ).toThrow('username')
  })
})

describe('exportMembers', () => {
  test('writes members and Discord accounts with fallback values', () => {
    const db = openMemberDatabase(':memory:')
    try {
      const result = exportMembers(db, [
        member({
          discord_id: '1',
          username: 'user1',
          global_name: 'Global One',
          server_name: 'Server One',
          joined_at: '2020-05-06T22:30:00.000000+00:00',
        }),
        member({
          discord_id: '2',
          username: 'user2',
          global_name: 'Global Two',
          joined_at: '2020-01-01T00:00:00.000000+00:00',
        }),
        member({
          discord_id: '3',
          username: 'user3',
          joined_at: null,
        }),
      ])

      expect(result).toEqual({
        members: 3,
        accounts: 3,
        preservedIds: 0,
        assignedNewIds: 3,
      })

      const members = db
        .query<MemberRow, []>(
          'SELECT member_id, nickname, joined_at FROM members ORDER BY member_id',
        )
        .all()
      expect(members).toEqual([
        {
          member_id: 1,
          nickname: 'Server One',
          joined_at: '2020-05-06T22:30:00.000Z',
        },
        {
          member_id: 2,
          nickname: 'Global Two',
          joined_at: '2020-01-01T00:00:00.000Z',
        },
        { member_id: 3, nickname: 'user3', joined_at: null },
      ])

      const accounts = db
        .query<AccountRow, []>(
          `SELECT discord_id, member_id, username, global_name, server_name, joined_at
           FROM discord_accounts
           ORDER BY member_id`,
        )
        .all()
      expect(accounts).toEqual([
        {
          discord_id: '1',
          member_id: 1,
          username: 'user1',
          global_name: 'Global One',
          server_name: 'Server One',
          joined_at: '2020-05-06T22:30:00.000Z',
        },
        {
          discord_id: '2',
          member_id: 2,
          username: 'user2',
          global_name: 'Global Two',
          server_name: null,
          joined_at: '2020-01-01T00:00:00.000Z',
        },
        {
          discord_id: '3',
          member_id: 3,
          username: 'user3',
          global_name: null,
          server_name: null,
          joined_at: null,
        },
      ])

      expect(db.query<Record<string, unknown>, []>('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      db.close()
    }
  })

  test('preserves existing member IDs and assigns new ones', () => {
    const db = openMemberDatabase(':memory:')
    try {
      exportMembers(db, [
        member({ discord_id: 'a', username: 'alpha' }),
        member({ discord_id: 'b', username: 'beta' }),
      ])
      expect(
        idMap(db),
      ).toEqual(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      )

      const result = exportMembers(db, [
        member({ discord_id: 'b', username: 'beta' }),
        member({ discord_id: 'c', username: 'gamma' }),
      ])

      expect(result.preservedIds).toBe(1)
      expect(result.assignedNewIds).toBe(1)
      expect(
        idMap(db),
      ).toEqual(
        new Map([
          ['b', 2],
          ['c', 3],
        ]),
      )

      const members = db
        .query<MemberRow, []>(
          'SELECT member_id, nickname, joined_at FROM members ORDER BY member_id',
        )
        .all()
      expect(members.map((row) => row.member_id)).toEqual([2, 3])
    } finally {
      db.close()
    }
  })

  test('replaces table contents and leaves unrelated tables alone', () => {
    const db = openMemberDatabase(':memory:')
    try {
      db.exec('CREATE TABLE keep_me (id INTEGER PRIMARY KEY)')
      db.run('INSERT INTO keep_me (id) VALUES (1)')

      exportMembers(db, [
        member({ discord_id: 'a', username: 'alpha' }),
        member({ discord_id: 'b', username: 'beta' }),
      ])
      exportMembers(db, [member({ discord_id: 'a', username: 'alpha' })])

      expect(
        db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM members').get()?.count,
      ).toBe(1)
      expect(
        db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM discord_accounts').get()
          ?.count,
      ).toBe(1)
      expect(
        db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM keep_me').get()?.count,
      ).toBe(1)
    } finally {
      db.close()
    }
  })
})

describe('openMemberDatabase migration', () => {
  test('renames the old columns and preserves member IDs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'member-db-'))
    const path = join(directory, 'members.sqlite')

    try {
      const old = new Database(path, { create: true })
      old.exec('PRAGMA foreign_keys = ON')
      old.exec(`
        CREATE TABLE members (
          id INTEGER PRIMARY KEY,
          nickname TEXT NOT NULL,
          join_date TEXT
        )
      `)
      old.exec(`
        CREATE TABLE discord_accounts (
          discord_id TEXT PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id),
          username TEXT NOT NULL,
          global_name TEXT,
          server_name TEXT,
          joined_at TEXT
        )
      `)
      old.run('INSERT INTO members (id, nickname, join_date) VALUES (?, ?, ?)', [
        7,
        'Old Nick',
        '2020-01-01',
      ])
      old.run(
        `INSERT INTO discord_accounts (
           discord_id, member_id, username, global_name, server_name, joined_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        ['a', 7, 'alpha', null, null, '2020-01-01T00:00:00.000000+00:00'],
      )
      old.close()

      const db = openMemberDatabase(path)
      try {
        const memberColumns = db
          .query<{ name: string }, []>('PRAGMA table_info(members)')
          .all()
          .map((column) => column.name)
        expect(memberColumns).toEqual(['member_id', 'nickname', 'joined_at'])

        const result = exportMembers(db, [
          member({
            discord_id: 'a',
            username: 'alpha',
            joined_at: '2020-05-06T22:30:00.000000+00:00',
          }),
        ])
        expect(result.preservedIds).toBe(1)
        expect(result.assignedNewIds).toBe(0)

        const row = db
          .query<MemberRow, []>(
            'SELECT member_id, nickname, joined_at FROM members',
          )
          .get()
        expect(row).toEqual({
          member_id: 7,
          nickname: 'alpha',
          joined_at: '2020-05-06T22:30:00.000Z',
        })
        expect(db.query<Record<string, unknown>, []>('PRAGMA foreign_key_check').all()).toEqual([])
      } finally {
        db.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
