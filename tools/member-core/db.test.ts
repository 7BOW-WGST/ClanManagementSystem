import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  openMemberDatabase,
  refreshCurrentNicknames,
  toIsoTimestamp,
} from './db'

interface MemberRow {
  member_id: number
  nickname: string
  joined_at: string | null
}

interface EventRow {
  nickname: string
  source: string
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
      'SELECT nickname, source FROM nickname_events ORDER BY nickname_event_id',
    )
    .all()
}

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
    expect(() => toIsoTimestamp('not-a-date', 'event_at')).toThrow('Invalid event_at')
  })
})

describe('refreshCurrentNicknames', () => {
  test('uses manual events and falls back to current placeholders', () => {
    const db = openMemberDatabase(':memory:')
    try {
      db.run('INSERT INTO members (member_id, nickname, joined_at) VALUES (1, ?, ?)', [
        'Placeholder One',
        '2020-01-01T00:00:00.000Z',
      ])
      db.run('INSERT INTO members (member_id, nickname, joined_at) VALUES (2, ?, ?)', [
        'Placeholder Two',
        '2020-01-01T00:00:00.000Z',
      ])
      db.run(
        `INSERT INTO nickname_events (
           member_id, nickname, event_at, source, recorded_at, created_by
         ) VALUES (1, ?, ?, 'manual', ?, 'owner')`,
        ['Manual One', '2021-01-01T00:00:00.000Z', '2021-01-02T00:00:00.000Z'],
      )

      refreshCurrentNicknames(
        db,
        new Map([
          [1, 'Placeholder One'],
          [2, 'Placeholder Two'],
        ]),
      )

      expect(members(db)).toEqual([
        { member_id: 1, nickname: 'Manual One', joined_at: '2020-01-01T00:00:00.000Z' },
        { member_id: 2, nickname: 'Placeholder Two', joined_at: '2020-01-01T00:00:00.000Z' },
      ])
    } finally {
      db.close()
    }
  })
})

describe('openMemberDatabase migration', () => {
  test('migrates old columns and drops obsolete provenance/reason columns', () => {
    const directory = mkdtempSync(join(tmpdir(), 'member-core-'))
    const path = join(directory, 'members.sqlite')

    try {
      const old = new Database(path, { create: true })
      old.exec('PRAGMA foreign_keys = ON')
      old.exec(`
        CREATE TABLE members (
          id INTEGER PRIMARY KEY,
          nickname TEXT NOT NULL,
          join_date TEXT,
          nickname_source TEXT NOT NULL DEFAULT 'discord_placeholder'
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
      old.exec(`
        CREATE TABLE nickname_events (
          nickname_event_id INTEGER PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id),
          nickname TEXT NOT NULL,
          event_at TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          recorded_at TEXT NOT NULL,
          created_by TEXT NOT NULL DEFAULT 'owner',
          reason TEXT
        )
      `)
      old.run('INSERT INTO members (id, nickname, join_date) VALUES (?, ?, ?)', [
        7,
        'Old Placeholder',
        '2020-01-01T00:00:00.000Z',
      ])
      old.run(
        `INSERT INTO discord_accounts (
           discord_id, member_id, username, global_name, server_name, joined_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        ['a', 7, 'alpha', null, null, '2020-01-01T00:00:00.000Z'],
      )
      old.run(
        `INSERT INTO nickname_events (
           member_id, nickname, event_at, source, recorded_at, created_by, reason
         ) VALUES (?, ?, ?, 'manual', ?, 'owner', ?)`,
        ['7', 'Old Manual', '2021-01-01T00:00:00.000Z', '2021-01-02T00:00:00.000Z', 'legacy'],
      )
      old.close()

      const db = openMemberDatabase(path)
      try {
        expect(
          db
            .query<{ name: string }, []>('PRAGMA table_info(members)')
            .all()
            .map((column) => column.name),
        ).toEqual(['member_id', 'nickname', 'joined_at'])
        expect(
          db
            .query<{ name: string }, []>('PRAGMA table_info(nickname_events)')
            .all()
            .map((column) => column.name),
        ).toEqual([
          'nickname_event_id',
          'member_id',
          'nickname',
          'event_at',
          'source',
          'recorded_at',
          'created_by',
        ])

        refreshCurrentNicknames(db, new Map([[7, 'Old Placeholder']]))
        expect(members(db)).toEqual([
          {
            member_id: 7,
            nickname: 'Old Manual',
            joined_at: '2020-01-01T00:00:00.000Z',
          },
        ])
        expect(events(db)).toEqual([{ nickname: 'Old Manual', source: 'manual' }])
        expect(db.query<Record<string, unknown>, []>('PRAGMA foreign_key_check').all()).toEqual([])
      } finally {
        db.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
