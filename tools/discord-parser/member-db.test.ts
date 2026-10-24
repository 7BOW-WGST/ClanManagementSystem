import { describe, expect, test } from 'bun:test'
import {
  exportMembers,
  joinDateFor,
  nicknameFor,
  openMemberDatabase,
  parseRoster,
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
  id: number
  nickname: string
  join_date: string | null
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

describe('joinDateFor', () => {
  test('converts to the Europe/Warsaw calendar date', () => {
    expect(joinDateFor('2020-05-06T22:30:00.000000+00:00')).toBe('2020-05-07')
    expect(joinDateFor('2020-01-01T00:00:00.000000+00:00')).toBe('2020-01-01')
    expect(joinDateFor(null)).toBeNull()
  })

  test('rejects invalid timestamps', () => {
    expect(() => joinDateFor('not-a-date')).toThrow('Invalid joined_at timestamp')
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
        .query<MemberRow, []>('SELECT id, nickname, join_date FROM members ORDER BY id')
        .all()
      expect(members).toEqual([
        { id: 1, nickname: 'Server One', join_date: '2020-05-07' },
        { id: 2, nickname: 'Global Two', join_date: '2020-01-01' },
        { id: 3, nickname: 'user3', join_date: null },
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
          joined_at: '2020-05-06T22:30:00.000000+00:00',
        },
        {
          discord_id: '2',
          member_id: 2,
          username: 'user2',
          global_name: 'Global Two',
          server_name: null,
          joined_at: '2020-01-01T00:00:00.000000+00:00',
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
      expect(idMap(db)).toEqual(new Map([
        ['a', 1],
        ['b', 2],
      ]))

      const result = exportMembers(db, [
        member({ discord_id: 'b', username: 'beta' }),
        member({ discord_id: 'c', username: 'gamma' }),
      ])

      expect(result.preservedIds).toBe(1)
      expect(result.assignedNewIds).toBe(1)
      expect(idMap(db)).toEqual(new Map([
        ['b', 2],
        ['c', 3],
      ]))

      const members = db.query<MemberRow, []>('SELECT id, nickname, join_date FROM members ORDER BY id').all()
      expect(members.map((row) => row.id)).toEqual([2, 3])
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
