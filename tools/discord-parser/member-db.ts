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
}

interface MemberIdMap {
  ids: Map<string, number>
  maxId: number
}

const CREATE_MEMBERS = `
  CREATE TABLE IF NOT EXISTS members (
    member_id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    joined_at TEXT
  )
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

// Placeholder nickname until general clan nicknames are entered manually.
export function nicknameFor(member: RosterMember): string {
  return firstNonEmpty(member.server_name, member.global_name, member.username) ?? member.username
}

export function toIsoTimestamp(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid joined_at timestamp: ${value}`)
  }
  return date.toISOString()
}

function tableColumns(db: Database, table: string): Set<string> {
  const rows = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
  return new Set(rows.map((row) => row.name))
}

// Migrate the first generated schema (id/join_date) without losing member IDs.
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
}

export function openMemberDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path, { create: true })
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(CREATE_MEMBERS)
  migrateMemberSchema(db)
  db.exec(CREATE_DISCORD_ACCOUNTS)
  db.exec(CREATE_DISCORD_ACCOUNTS_INDEX)
  return db
}

function readMemberIdMap(db: Database): MemberIdMap {
  const rows = db
    .query<{ discord_id: string; member_id: number }, []>(
      'SELECT discord_id, member_id FROM discord_accounts',
    )
    .all()

  const ids = new Map<string, number>()
  let maxId = 0
  for (const row of rows) {
    ids.set(row.discord_id, row.member_id)
    if (row.member_id > maxId) {
      maxId = row.member_id
    }
  }
  return { ids, maxId }
}

// Replace both tables while preserving member IDs for Discord accounts seen previously.
export function exportMembers(db: Database, members: RosterMember[]): ExportResult {
  const existing = readMemberIdMap(db)
  let nextId = existing.maxId + 1
  let preservedIds = 0
  let assignedNewIds = 0

  const rows = members.map((member) => {
    const existingId = existing.ids.get(member.discord_id)
    const memberId = existingId ?? nextId++

    if (existingId === undefined) {
      assignedNewIds += 1
    } else {
      preservedIds += 1
    }

    return {
      memberId,
      nickname: nicknameFor(member),
      joinedAt: toIsoTimestamp(member.joined_at),
      member,
    }
  })

  const replace = db.transaction(() => {
    db.run('DELETE FROM discord_accounts')
    db.run('DELETE FROM members')

    for (const row of rows) {
      db.run(INSERT_MEMBER, [row.memberId, row.nickname, row.joinedAt])
      db.run(INSERT_DISCORD_ACCOUNT, [
        row.member.discord_id,
        row.memberId,
        row.member.username,
        row.member.global_name,
        row.member.server_name,
        row.joinedAt,
      ])
    }
  })

  replace()

  return {
    members: rows.length,
    accounts: rows.length,
    preservedIds,
    assignedNewIds,
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
