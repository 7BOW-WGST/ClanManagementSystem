import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { GuildMemberRecord } from './types'

interface GuildMemberRow {
  guild_id: string
  user_id: string
  username: string
  global_name: string | null
  server_name: string | null
  joined_at: string | null
  is_bot: number
  pending: number
  first_seen_at: string
  last_seen_at: string
}

export interface RosterRunRecord {
  guildId: string
  fetchedAt: string
  fetchedCount: number
  keptCount: number
  botCount: number
  pendingCount: number
}

const CREATE_GUILD_MEMBERS = `
  CREATE TABLE IF NOT EXISTS guild_members (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    global_name TEXT,
    server_name TEXT,
    joined_at TEXT,
    is_bot INTEGER NOT NULL,
    pending INTEGER NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  )
`

const CREATE_ROSTER_RUNS = `
  CREATE TABLE IF NOT EXISTS roster_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    fetched_count INTEGER NOT NULL,
    kept_count INTEGER NOT NULL,
    bot_count INTEGER NOT NULL,
    pending_count INTEGER NOT NULL
  )
`

const UPSERT_MEMBER = `
  INSERT INTO guild_members (
    guild_id, user_id, username, global_name, server_name, joined_at, is_bot, pending, first_seen_at, last_seen_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (guild_id, user_id) DO UPDATE SET
    username = excluded.username,
    global_name = excluded.global_name,
    server_name = excluded.server_name,
    joined_at = excluded.joined_at,
    is_bot = excluded.is_bot,
    pending = excluded.pending,
    last_seen_at = excluded.last_seen_at
`

const INSERT_RUN = `
  INSERT INTO roster_runs (
    guild_id, fetched_at, fetched_count, kept_count, bot_count, pending_count
  ) VALUES (?, ?, ?, ?, ?, ?)
`

// Local snapshot cache. It deduplicates members across runs but does not infer departures.
export class RosterCache {
  private readonly db: Database

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }

    this.db = new Database(path, { create: true })
    this.db.exec(CREATE_GUILD_MEMBERS)
    this.ensureGuildMemberColumns()
    this.db.exec(CREATE_ROSTER_RUNS)
  }

  // Add columns introduced after the first roster schema without wiping existing caches.
  private ensureGuildMemberColumns(): void {
    const columns = this.db
      .query<{ name: string }, []>('PRAGMA table_info(guild_members)')
      .all()
    const existing = new Set(columns.map((column) => column.name))

    if (!existing.has('global_name')) {
      this.db.exec('ALTER TABLE guild_members ADD COLUMN global_name TEXT')
    }
    if (!existing.has('joined_at')) {
      this.db.exec('ALTER TABLE guild_members ADD COLUMN joined_at TEXT')
    }
  }

  upsertMembers(guildId: string, members: GuildMemberRecord[]): void {
    const upsert = this.db.transaction((rows: GuildMemberRecord[]) => {
      for (const row of rows) {
        this.db.run(UPSERT_MEMBER, [
          guildId,
          row.discord_id,
          row.username,
          row.global_name,
          row.server_name,
          row.joined_at,
          row.is_bot ? 1 : 0,
          row.pending ? 1 : 0,
          row.first_seen_at,
          row.last_seen_at,
        ])
      }
    })

    upsert(members)
  }

  recordRun(run: RosterRunRecord): void {
    this.db.run(INSERT_RUN, [
      run.guildId,
      run.fetchedAt,
      run.fetchedCount,
      run.keptCount,
      run.botCount,
      run.pendingCount,
    ])
  }

  listMembers(guildId: string): GuildMemberRecord[] {
    const rows = this.db
      .query<GuildMemberRow, [string]>(
        `SELECT guild_id, user_id, username, global_name, server_name, joined_at, is_bot, pending, first_seen_at, last_seen_at
         FROM guild_members
         WHERE guild_id = ?
         ORDER BY user_id ASC`,
      )
      .all(guildId)

    return rows.map((row) => ({
      discord_id: row.user_id,
      username: row.username,
      global_name: row.global_name,
      server_name: row.server_name,
      joined_at: row.joined_at,
      is_bot: row.is_bot === 1,
      pending: row.pending === 1,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
    }))
  }

  close(): void {
    this.db.close()
  }
}
