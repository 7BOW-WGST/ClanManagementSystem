import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { RosterMember } from './types'

export interface ParsedRoster {
  members: RosterMember[]
  keptCount: number | null
}

export interface ExportResult {
  members: number
  accounts: number
  preservedIds: number
  assignedNewIds: number
  historicalMembers: number
}

interface MemberState {
  idsByDiscord: Map<string, number>
  existingMemberIds: Set<number>
  maxMemberId: number
}

interface CurrentMemberRow {
  memberId: number
  placeholder: string
  joinedAt: string | null
  member: RosterMember
}

const CREATE_MEMBERS = `
  CREATE TABLE IF NOT EXISTS members (
    member_id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    joined_at TEXT
  )
`

const CREATE_NICKNAME_EVENTS = `
  CREATE TABLE IF NOT EXISTS nickname_events (
    nickname_event_id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(member_id),
    nickname TEXT NOT NULL,
    event_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    recorded_at TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'owner'
  )
`

const CREATE_NICKNAME_EVENTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_nickname_events_member
  ON nickname_events(member_id, event_at, recorded_at)
`

const CREATE_DISCORD_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS discord_accounts (
    discord_id TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(member_id),
    username TEXT NOT NULL,
    global_name TEXT,
    server_name TEXT,
    joined_at TEXT
  )
`

const CREATE_DISCORD_ACCOUNTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_discord_accounts_member_id
  ON discord_accounts(member_id)
`

const INSERT_MEMBER = `
  INSERT INTO members (member_id, nickname, joined_at) VALUES (?, ?, ?)
`

const INSERT_DISCORD_ACCOUNT = `
  INSERT INTO discord_accounts (
    discord_id, member_id, username, global_name, server_name, joined_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string.`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null.`)
  }
  return value === '' ? null : value
}

function stringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`${field} must be an array of strings.`)
  }
  return value
}

// Parse and validate output/discord-members.json without trusting its shape.
export function parseRoster(value: unknown): ParsedRoster {
  if (!isRecord(value)) {
    throw new Error('Roster JSON must be an object.')
  }

  const rawMembers = value.members
  if (!Array.isArray(rawMembers)) {
    throw new Error('Roster JSON must contain a members array.')
  }

  const members: RosterMember[] = rawMembers.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`members[${index}] must be an object.`)
    }

    return {
      discord_id: requiredString(entry.discord_id, `members[${index}].discord_id`),
      username: requiredString(entry.username, `members[${index}].username`),
      global_name: optionalString(entry.global_name, `members[${index}].global_name`),
      server_name: optionalString(entry.server_name, `members[${index}].server_name`),
      joined_at: optionalString(entry.joined_at, `members[${index}].joined_at`),
      matched_role_ids: stringArray(
        entry.matched_role_ids,
        `members[${index}].matched_role_ids`,
      ),
    }
  })

  const seen = new Set<string>()
  for (const member of members) {
    if (seen.has(member.discord_id)) {
      throw new Error(`Duplicate discord_id in roster JSON: ${member.discord_id}`)
    }
    seen.add(member.discord_id)
  }

  let keptCount: number | null = null
  if (isRecord(value.meta) && typeof value.meta.kept_count === 'number') {
    keptCount = value.meta.kept_count
  }

  return { members, keptCount }
}

function firstNonEmpty(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value !== null && value.trim() !== '') {
      return value
    }
  }
  return null
}

// Convenience placeholder until a manual clan nickname event exists.
export function nicknameFor(member: RosterMember): string {
  return firstNonEmpty(member.server_name, member.global_name, member.username) ?? member.username
}

export function toIsoTimestamp(value: string | null, label = 'timestamp'): string | null {
  if (value === null) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return date.toISOString()
}

function tableColumns(db: Database, table: string): Set<string> {
  const rows = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
  return new Set(rows.map((row) => row.name))
}

// Migrate earlier generated schemas without losing member IDs or nicknames.
function migrateMemberSchema(db: Database): void {
  const columns = tableColumns(db, 'members')

  if (columns.has('member_id') && columns.has('id')) {
    throw new Error('members has both id and member_id columns; refusing to migrate.')
  }
  if (!columns.has('member_id')) {
    if (!columns.has('id')) {
      throw new Error('members is missing the id/member_id column.')
    }
    db.exec('ALTER TABLE members RENAME COLUMN id TO member_id')
  }

  const renamed = tableColumns(db, 'members')
  if (renamed.has('joined_at') && renamed.has('join_date')) {
    throw new Error('members has both join_date and joined_at columns; refusing to migrate.')
  }
  if (!renamed.has('joined_at')) {
    if (renamed.has('join_date')) {
      db.exec('ALTER TABLE members RENAME COLUMN join_date TO joined_at')
    } else {
      db.exec('ALTER TABLE members ADD COLUMN joined_at TEXT')
    }
  }

  if (renamed.has('nickname_source')) {
    db.exec('ALTER TABLE members DROP COLUMN nickname_source')
  }
}

function migrateNicknameEventsSchema(db: Database): void {
  const columns = tableColumns(db, 'nickname_events')
  if (columns.has('reason')) {
    db.exec('ALTER TABLE nickname_events DROP COLUMN reason')
  }
}

export function openMemberDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path, { create: true })
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(CREATE_MEMBERS)
  migrateMemberSchema(db)
  db.exec(CREATE_NICKNAME_EVENTS)
  migrateNicknameEventsSchema(db)
  db.exec(CREATE_NICKNAME_EVENTS_INDEX)
  db.exec(CREATE_DISCORD_ACCOUNTS)
  db.exec(CREATE_DISCORD_ACCOUNTS_INDEX)
  return db
}

function readMemberState(db: Database): MemberState {
  const accounts = db
    .query<{ discord_id: string; member_id: number }, []>(
      'SELECT discord_id, member_id FROM discord_accounts',
    )
    .all()
  const memberRows = db
    .query<{ member_id: number }, []>('SELECT member_id FROM members')
    .all()

  const existingMemberIds = new Set(memberRows.map((row) => row.member_id))
  const idsByDiscord = new Map<string, number>()
  let maxMemberId = 0

  for (const row of accounts) {
    if (!existingMemberIds.has(row.member_id)) {
      throw new Error(
        `Discord account ${row.discord_id} references missing member ${row.member_id}.`,
      )
    }
    idsByDiscord.set(row.discord_id, row.member_id)
  }
  for (const memberId of existingMemberIds) {
    if (memberId > maxMemberId) {
      maxMemberId = memberId
    }
  }

  return { idsByDiscord, existingMemberIds, maxMemberId }
}

// Latest manual nickname event per member. event_at/recorded_at are normalized UTC ISO strings,
// so lexicographic ordering is chronological.
export function latestNicknameEvents(db: Database): Map<number, string> {
  const rows = db
    .query<{ member_id: number; nickname: string }, []>(
      `SELECT member_id, nickname
       FROM nickname_events
       WHERE source = 'manual'
       ORDER BY member_id ASC, event_at DESC, recorded_at DESC, nickname_event_id DESC`,
    )
    .all()

  const latest = new Map<number, string>()
  for (const row of rows) {
    if (!latest.has(row.member_id)) {
      latest.set(row.member_id, row.nickname)
    }
  }
  return latest
}

// Apply manual events to current and historical members; fall back to placeholders only for the
// current roster when no manual event exists.
export function refreshCurrentNicknames(
  db: Database,
  currentPlaceholders: ReadonlyMap<number, string>,
): void {
  const latest = latestNicknameEvents(db)

  for (const [memberId, nickname] of latest) {
    db.run(
      'UPDATE members SET nickname = ? WHERE member_id = ?',
      [nickname, memberId],
    )
  }

  for (const [memberId, placeholder] of currentPlaceholders) {
    if (!latest.has(memberId)) {
      db.run(
        'UPDATE members SET nickname = ? WHERE member_id = ?',
        [placeholder, memberId],
      )
    }
  }
}

export function refreshNicknamesForMembers(db: Database, memberIds: Iterable<number>): void {
  const latest = latestNicknameEvents(db)
  for (const memberId of memberIds) {
    const nickname = latest.get(memberId)
    if (nickname !== undefined) {
      db.run(
        'UPDATE members SET nickname = ? WHERE member_id = ?',
        [nickname, memberId],
      )
    }
  }
}

// Add missing members, refresh current placeholders, replace current accounts, and preserve
// historical members plus nickname events.
export function exportMembers(db: Database, members: RosterMember[]): ExportResult {
  const state = readMemberState(db)
  let nextId = state.maxMemberId + 1
  let preservedIds = 0
  let assignedNewIds = 0

  const rows: CurrentMemberRow[] = []
  const currentPlaceholders = new Map<number, string>()

  for (const member of members) {
    const existingId = state.idsByDiscord.get(member.discord_id)
    const memberId = existingId ?? nextId++

    if (existingId === undefined) {
      assignedNewIds += 1
    } else {
      preservedIds += 1
    }

    const placeholder = nicknameFor(member)
    rows.push({
      memberId,
      placeholder,
      joinedAt: toIsoTimestamp(member.joined_at, 'joined_at'),
      member,
    })
    currentPlaceholders.set(memberId, placeholder)
  }

  const write = db.transaction(() => {
    for (const row of rows) {
      if (!state.existingMemberIds.has(row.memberId)) {
        db.run(INSERT_MEMBER, [
          row.memberId,
          row.placeholder,
          row.joinedAt,
        ])
      }
    }

    db.run('DELETE FROM discord_accounts')
    for (const row of rows) {
      db.run(INSERT_DISCORD_ACCOUNT, [
        row.member.discord_id,
        row.memberId,
        row.member.username,
        row.member.global_name,
        row.member.server_name,
        row.joinedAt,
      ])
    }

    refreshCurrentNicknames(db, currentPlaceholders)
  })

  write()

  const totalMembers =
    db.query<{ n: number }, []>('SELECT COUNT(*) AS n FROM members').get()?.n ?? 0

  return {
    members: rows.length,
    accounts: rows.length,
    preservedIds,
    assignedNewIds,
    historicalMembers: totalMembers - rows.length,
  }
}

export function writeMemberDatabase(path: string, members: RosterMember[]): ExportResult {
  const db = openMemberDatabase(path)
  try {
    return exportMembers(db, members)
  } finally {
    db.close()
  }
}
