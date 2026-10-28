import type { Database } from 'bun:sqlite'
import {
  nicknameFor,
  refreshNicknamesForMembers,
  toIsoTimestamp,
} from './member-db'
import type { RosterMember } from './types'

export interface NicknameCsvRow {
  line: number
  discord_id: string
  nickname: string
}

export interface ImportResult {
  processed: number
  inserted: number
  skipped: number
  dryRun: boolean
}

interface ParsedCsvRow {
  line: number
  values: string[]
}

interface MemberLookup {
  memberId: number
  joinedAt: string | null
}

interface PreparedEvent {
  memberId: number
  nickname: string
  eventAt: string
  duplicate: boolean
}

const INSERT_NICKNAME_EVENT = `
  INSERT INTO nickname_events (
    member_id, nickname, event_at, source, recorded_at, created_by
  ) VALUES (?, ?, ?, 'manual', ?, 'owner')
`

const FIND_NICKNAME_EVENT = `
  SELECT 1 AS found
  FROM nickname_events
  WHERE member_id = ? AND nickname = ? AND event_at = ? AND source = 'manual'
  LIMIT 1
`

// Minimal RFC 4180-style parser: quoted fields, escaped quotes, commas, and newlines.
function parseCsv(text: string): ParsedCsvRow[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: ParsedCsvRow[] = []
  let values: string[] = []
  let value = ''
  let inQuotes = false
  let line = 1
  let rowStartLine = 1
  let index = 0

  const pushValue = (): void => {
    values.push(value)
    value = ''
  }

  const pushRow = (): void => {
    pushValue()
    rows.push({ line: rowStartLine, values })
    values = []
  }

  while (index < input.length) {
    const character = input[index]

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          value += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      if (character === '\n') {
        line += 1
      }
      value += character
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (character === ',') {
      pushValue()
      index += 1
      continue
    }
    if (character === '\r') {
      index += 1
      continue
    }
    if (character === '\n') {
      pushRow()
      line += 1
      rowStartLine = line
      index += 1
      continue
    }

    value += character
    index += 1
  }

  if (value !== '' || values.length > 0) {
    pushRow()
  }

  return rows
}

export function parseNicknameCsv(text: string): NicknameCsvRow[] {
  const rows = parseCsv(text).filter((row) => row.values.some((entry) => entry.trim() !== ''))
  const header = rows[0]
  if (header === undefined) {
    return []
  }

  const columns = new Map<string, number>()
  header.values.forEach((name, index) => {
    columns.set(name.trim().toLowerCase(), index)
  })

  for (const required of ['discord_id', 'nickname']) {
    if (!columns.has(required)) {
      throw new Error(`CSV is missing the required "${required}" column.`)
    }
  }

  const result: NicknameCsvRow[] = []

  for (const row of rows.slice(1)) {
    const get = (name: string): string => {
      const index = columns.get(name)
      if (index === undefined) {
        return ''
      }
      return (row.values[index] ?? '').trim()
    }

    const discordId = get('discord_id')
    const nickname = get('nickname')
    if (discordId === '' && nickname === '') {
      continue
    }
    if (discordId === '') {
      throw new Error(`Line ${row.line}: discord_id is required.`)
    }
    if (nickname === '') {
      throw new Error(`Line ${row.line}: nickname is required.`)
    }

    result.push({
      line: row.line,
      discord_id: discordId,
      nickname,
    })
  }

  return result
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

export function buildNicknameCsv(members: RosterMember[]): string {
  const lines = ['discord_id,nickname']
  for (const member of members) {
    lines.push(`${escapeCsvField(member.discord_id)},${escapeCsvField(nicknameFor(member))}`)
  }
  return `${lines.join('\n')}\n`
}

export function hasNicknameData(text: string): boolean {
  if (text.trim() === '') {
    return false
  }
  try {
    return parseNicknameCsv(text).length > 0
  } catch {
    return true
  }
}

function loadMemberLookup(db: Database): Map<string, MemberLookup> {
  const rows = db
    .query<{ discord_id: string; member_id: number; joined_at: string | null }, []>(
      `SELECT a.discord_id, a.member_id, m.joined_at
       FROM discord_accounts a
       JOIN members m ON m.member_id = a.member_id`,
    )
    .all()

  const lookup = new Map<string, MemberLookup>()
  for (const row of rows) {
    lookup.set(row.discord_id, {
      memberId: row.member_id,
      joinedAt: row.joined_at,
    })
  }
  return lookup
}

export function importNicknameCsv(
  db: Database,
  text: string,
  options: { dryRun: boolean },
): ImportResult {
  const rows = parseNicknameCsv(text)
  const lookup = loadMemberLookup(db)
  const recordedAt = new Date().toISOString()
  const seenInFile = new Set<string>()
  const prepared: PreparedEvent[] = []

  for (const row of rows) {
    const member = lookup.get(row.discord_id)
    if (member === undefined) {
      throw new Error(
        `Line ${row.line}: unknown or non-current Discord ID ${row.discord_id}.`,
      )
    }

    const eventAtRaw = member.joinedAt
    if (eventAtRaw === null) {
      throw new Error(
        `Line ${row.line}: member ${row.discord_id} has no joined_at; cannot import nickname.`,
      )
    }

    const eventAt = toIsoTimestamp(eventAtRaw, 'joined_at')
    if (eventAt === null) {
      throw new Error(`Line ${row.line}: joined_at is required.`)
    }

    const naturalKey = `${member.memberId}\u0000${row.nickname}\u0000${eventAt}`
    let duplicate = seenInFile.has(naturalKey)
    seenInFile.add(naturalKey)

    if (!duplicate) {
      const existing = db
        .query<{ found: number }, [number, string, string]>(FIND_NICKNAME_EVENT)
        .get(member.memberId, row.nickname, eventAt)
      duplicate = existing !== null
    }

    prepared.push({
      memberId: member.memberId,
      nickname: row.nickname,
      eventAt,
      duplicate,
    })
  }

  const toInsert = prepared.filter((event) => !event.duplicate)

  if (!options.dryRun && toInsert.length > 0) {
    const write = db.transaction(() => {
      for (const event of toInsert) {
        db.run(INSERT_NICKNAME_EVENT, [
          event.memberId,
          event.nickname,
          event.eventAt,
          recordedAt,
        ])
      }
      refreshNicknamesForMembers(
        db,
        new Set(toInsert.map((event) => event.memberId)),
      )
    })
    write()
  }

  return {
    processed: prepared.length,
    inserted: toInsert.length,
    skipped: prepared.length - toInsert.length,
    dryRun: options.dryRun,
  }
}
