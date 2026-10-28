import type { Database } from 'bun:sqlite'
import {
  insertMember,
  openMemberDatabase,
  readMemberState,
  refreshCurrentNicknames,
  replaceDiscordAccounts,
  toIsoTimestamp,
} from './db'

export interface RosterMember {
  discord_id: string
  username: string
  global_name: string | null
  server_name: string | null
  joined_at: string | null
  matched_role_ids: string[]
}

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

interface CurrentMemberRow {
  memberId: number
  placeholder: string
  joinedAt: string | null
  member: RosterMember
}

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

// Parse and validate the discord-parser output without trusting its shape.
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

// Discord-only convenience fallback until a manual core nickname event exists.
export function discordPlaceholderNickname(member: RosterMember): string {
  return firstNonEmpty(member.server_name, member.global_name, member.username) ?? member.username
}

// Add missing members, refresh current placeholders, replace current accounts, and preserve
// historical members plus nickname events.
export function importDiscordRoster(db: Database, members: RosterMember[]): ExportResult {
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

    const placeholder = discordPlaceholderNickname(member)
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
        insertMember(db, row.memberId, row.placeholder, row.joinedAt)
      }
    }

    replaceDiscordAccounts(
      db,
      rows.map((row) => ({
        discordId: row.member.discord_id,
        memberId: row.memberId,
        username: row.member.username,
        globalName: row.member.global_name,
        serverName: row.member.server_name,
        joinedAt: row.joinedAt,
      })),
    )

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

export function writeDiscordRosterDatabase(
  path: string,
  members: RosterMember[],
): ExportResult {
  const db = openMemberDatabase(path)
  try {
    return importDiscordRoster(db, members)
  } finally {
    db.close()
  }
}
