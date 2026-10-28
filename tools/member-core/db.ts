import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface DiscordAccountRowInput {
  discordId: string
  memberId: number
  username: string
  globalName: string | null
  serverName: string | null
  joinedAt: string | null
}

export interface MemberState {
  idsByDiscord: Map<string, number>
  existingMemberIds: Set<number>
  maxMemberId: number
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

const CREATE_WARTHUNDER_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS warthunder_accounts (
    wt_id TEXT PRIMARY KEY,
    member_id INTEGER REFERENCES members(member_id),
    username TEXT NOT NULL,
    ownership_type TEXT NOT NULL DEFAULT 'main'
      CHECK (ownership_type IN ('main', 'alt', 'borrowed')),
    squadron TEXT
      CHECK (squadron IN ('7BOW', '7BOWs', '7BOWr')),
    squadron_role TEXT,
    squadron_joined_at TEXT
  )
`

const CREATE_WARTHUNDER_ACCOUNTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_warthunder_accounts_member_id
  ON warthunder_accounts(member_id)
`

const INSERT_MEMBER = `
  INSERT INTO members (member_id, nickname, joined_at) VALUES (?, ?, ?)
`

const INSERT_DISCORD_ACCOUNT = `
  INSERT INTO discord_accounts (
    discord_id, member_id, username, global_name, server_name, joined_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`

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
  db.exec(CREATE_WARTHUNDER_ACCOUNTS)
  db.exec(CREATE_WARTHUNDER_ACCOUNTS_INDEX)
  return db
}

export function readMemberState(db: Database): MemberState {
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

export function insertMember(
  db: Database,
  memberId: number,
  nickname: string,
  joinedAt: string | null,
): void {
  db.run(INSERT_MEMBER, [memberId, nickname, joinedAt])
}

export function replaceDiscordAccounts(
  db: Database,
  accounts: DiscordAccountRowInput[],
): void {
  db.run('DELETE FROM discord_accounts')
  for (const account of accounts) {
    db.run(INSERT_DISCORD_ACCOUNT, [
      account.discordId,
      account.memberId,
      account.username,
      account.globalName,
      account.serverName,
      account.joinedAt,
    ])
  }
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
    db.run('UPDATE members SET nickname = ? WHERE member_id = ?', [nickname, memberId])
  }

  for (const [memberId, placeholder] of currentPlaceholders) {
    if (!latest.has(memberId)) {
      db.run('UPDATE members SET nickname = ? WHERE member_id = ?', [placeholder, memberId])
    }
  }
}

export function refreshNicknamesForMembers(db: Database, memberIds: Iterable<number>): void {
  const latest = latestNicknameEvents(db)
  for (const memberId of memberIds) {
    const nickname = latest.get(memberId)
    if (nickname !== undefined) {
      db.run('UPDATE members SET nickname = ? WHERE member_id = ?', [nickname, memberId])
    }
  }
}
