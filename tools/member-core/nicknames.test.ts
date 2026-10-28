import { describe, expect, test } from 'bun:test'
import { openMemberDatabase } from './db'
import { importDiscordRoster, type RosterMember } from './discord-roster'
import {
  buildNicknameCsv,
  escapeCsvField,
  hasNicknameData,
  importNicknameCsv,
  parseNicknameCsv,
} from './nicknames'

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

interface EventRow {
  member_id: number
  nickname: string
  event_at: string
  source: string
  created_by: string
}

function members(db: ReturnType<typeof openMemberDatabase>): MemberRow[] {
  return db
    .query<MemberRow, []>(
      'SELECT member_id, nickname, joined_at FROM members ORDER BY member_id',
    )
    .all()
}

function events(db: ReturnType<typeof openMemberDatabase>): EventRow[] {
  return db
    .query<EventRow, []>(
      `SELECT member_id, nickname, event_at, source, created_by
       FROM nickname_events
       ORDER BY nickname_event_id`,
    )
    .all()
}

describe('parseNicknameCsv', () => {
  test('handles quoted fields, Polish characters, and optional extra columns', () => {
    const rows = parseNicknameCsv(
      'discord_id,nickname,event_at,reason\r\n' +
        '1,"Kamil, Jr",2021-02-03T04:05:06.000Z,ignored\r\n' +
        '2,Żółć,,\r\n',
    )

    expect(rows).toEqual([
      { line: 2, discord_id: '1', nickname: 'Kamil, Jr' },
      { line: 3, discord_id: '2', nickname: 'Żółć' },
    ])
  })

  test('rejects a missing required column', () => {
    expect(() => parseNicknameCsv('discord_id,event_at\n1,2020-01-01T00:00:00.000Z')).toThrow(
      'nickname',
    )
  })
})

describe('CSV prefill helpers', () => {
  test('escapes fields containing commas, quotes, and newlines', () => {
    expect(escapeCsvField('plain')).toBe('plain')
    expect(escapeCsvField('Kamil, Jr')).toBe('"Kamil, Jr"')
    expect(escapeCsvField('Kamil "Jr"')).toBe('"Kamil ""Jr"""')
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"')
  })

  test('builds a two-column CSV from prepared entries', () => {
    const csv = buildNicknameCsv([
      { discord_id: '1', nickname: 'Server One' },
      { discord_id: '2', nickname: 'Global Two' },
      { discord_id: '3', nickname: 'user3' },
    ])

    expect(csv).toBe(
      'discord_id,nickname\n' +
        '1,Server One\n' +
        '2,Global Two\n' +
        '3,user3\n',
    )
    expect(parseNicknameCsv(csv)).toEqual([
      { line: 2, discord_id: '1', nickname: 'Server One' },
      { line: 3, discord_id: '2', nickname: 'Global Two' },
      { line: 4, discord_id: '3', nickname: 'user3' },
    ])
  })

  test('detects header-only versus populated files', () => {
    expect(hasNicknameData('discord_id,nickname\n')).toBe(false)
    expect(hasNicknameData('discord_id,nickname\n1,Name\n')).toBe(true)
  })
})

describe('importNicknameCsv', () => {
  test('imports ID/nickname rows using joined_at as event_at', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [
        member({ discord_id: 'a', username: 'alpha', server_name: 'Placeholder A' }),
        member({
          discord_id: 'b',
          username: 'beta',
          joined_at: '2020-05-06T22:30:00.000000+00:00',
        }),
      ])

      const result = importNicknameCsv(
        db,
        'discord_id,nickname\n' +
          'a,Manual A\n' +
          'b,Manual B\n',
        { dryRun: false },
      )

      expect(result).toEqual({
        processed: 2,
        inserted: 2,
        skipped: 0,
        dryRun: false,
      })

      expect(members(db)).toEqual([
        {
          member_id: 1,
          nickname: 'Manual A',
          joined_at: '2020-01-01T00:00:00.000Z',
        },
        {
          member_id: 2,
          nickname: 'Manual B',
          joined_at: '2020-05-06T22:30:00.000Z',
        },
      ])

      expect(events(db)).toEqual([
        {
          member_id: 1,
          nickname: 'Manual A',
          event_at: '2020-01-01T00:00:00.000Z',
          source: 'manual',
          created_by: 'owner',
        },
        {
          member_id: 2,
          nickname: 'Manual B',
          event_at: '2020-05-06T22:30:00.000Z',
          source: 'manual',
          created_by: 'owner',
        },
      ])
    } finally {
      db.close()
    }
  })

  test('skips duplicate events on repeated imports', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [member({ discord_id: 'a', username: 'alpha' })])
      const csv = 'discord_id,nickname\na,Manual A\n'

      const first = importNicknameCsv(db, csv, { dryRun: false })
      const second = importNicknameCsv(db, csv, { dryRun: false })

      expect(first.inserted).toBe(1)
      expect(second.inserted).toBe(0)
      expect(second.skipped).toBe(1)
      expect(events(db)).toHaveLength(1)
    } finally {
      db.close()
    }
  })

  test('latest event determines the current nickname', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [member({ discord_id: 'a', username: 'alpha' })])
      importNicknameCsv(
        db,
        'discord_id,nickname\n' +
          'a,Old Name\n' +
          'a,New Name\n',
        { dryRun: false },
      )

      expect(members(db)[0]?.nickname).toBe('New Name')
    } finally {
      db.close()
    }
  })

  test('dry run validates without writing', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [member({ discord_id: 'a', username: 'alpha' })])
      const result = importNicknameCsv(
        db,
        'discord_id,nickname\na,Manual A\n',
        { dryRun: true },
      )

      expect(result.inserted).toBe(1)
      expect(events(db)).toHaveLength(0)
      expect(members(db)[0]?.nickname).toBe('alpha')
    } finally {
      db.close()
    }
  })

  test('rejects unknown or non-current Discord IDs', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [member({ discord_id: 'a', username: 'alpha' })])
      expect(() =>
        importNicknameCsv(db, 'discord_id,nickname\nmissing,Manual\n', { dryRun: false }),
      ).toThrow('unknown or non-current Discord ID')
    } finally {
      db.close()
    }
  })

  test('requires joined_at for every imported member', () => {
    const db = openMemberDatabase(':memory:')
    try {
      importDiscordRoster(db, [
        member({ discord_id: 'a', username: 'alpha', joined_at: null }),
      ])
      expect(() =>
        importNicknameCsv(db, 'discord_id,nickname\na,Manual A\n', { dryRun: false }),
      ).toThrow('has no joined_at')
    } finally {
      db.close()
    }
  })
})
