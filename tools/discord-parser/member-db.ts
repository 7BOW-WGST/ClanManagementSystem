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
    id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL,
    join_date TEXT
  )
`

const CREATE_DISCORD_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS discord_accounts (
    discord_id TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
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
  INSERT INTO members (id, nickname, join_date) VALUES (?, ?, ?)
`

const INSERT_DISCORD_ACCOUNT = `
  INSERT INTO discord_accounts (
    discord_id, member_id, username, global_name, server_name, joined_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`

const WARSAW_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

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

function formatWarsawDate(date: Date): string {
  const parts = WARSAW_DATE.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Could not format the Discord join timestamp.')
  }
  return `${year}-${month}-${day}`
}

export function joinDateFor(joinedAt: string | null): string | null {
  if (joinedAt === null) {
    return null
  }

  const date = new Date(joinedAt)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid joined_at timestamp: ${joinedAt}`)
  }
  return formatWarsawDate(date)
}

export function openMemberDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path, { create: true })
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(CREATE_MEMBERS)
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
    const id = existingId ?? nextId++

    if (existingId === undefined) {
      assignedNewIds += 1
    } else {
      preservedIds += 1
    }

    return {
      id,
      nickname: nicknameFor(member),
      joinDate: joinDateFor(member.joined_at),
      member,
    }
  })

  const replace = db.transaction(() => {
    db.run('DELETE FROM discord_accounts')
    db.run('DELETE FROM members')

    for (const row of rows) {
      db.run(INSERT_MEMBER, [row.id, row.nickname, row.joinDate])
      db.run(INSERT_DISCORD_ACCOUNT, [
        row.member.discord_id,
        row.id,
        row.member.username,
        row.member.global_name,
        row.member.server_name,
        row.member.joined_at,
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
