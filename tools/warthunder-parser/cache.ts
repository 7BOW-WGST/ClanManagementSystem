import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ClanMember } from './clan-page'

export interface CachedNickname {
  wtId: string
  matchedUsername: string
}

const CREATE_NICKNAME_CACHE = `
  CREATE TABLE IF NOT EXISTS nickname_id_cache (
    nickname TEXT PRIMARY KEY,
    wt_id TEXT NOT NULL,
    matched_username TEXT NOT NULL,
    resolved_at TEXT NOT NULL
  )
`

const CREATE_CLAN_MEMBERS = `
  CREATE TABLE IF NOT EXISTS clan_members (
    squadron TEXT NOT NULL,
    username TEXT NOT NULL,
    squadron_role TEXT,
    squadron_joined_at TEXT NOT NULL,
    personal_clan_rating INTEGER,
    activity INTEGER,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (squadron, username)
  )
`

const UPSERT_CLAN_MEMBER = `
  INSERT INTO clan_members (
    squadron, username, squadron_role, squadron_joined_at,
    personal_clan_rating, activity, fetched_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (squadron, username) DO UPDATE SET
    squadron_role = excluded.squadron_role,
    squadron_joined_at = excluded.squadron_joined_at,
    personal_clan_rating = excluded.personal_clan_rating,
    activity = excluded.activity,
    fetched_at = excluded.fetched_at
`

export class WtCache {
  private readonly db: Database

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }

    this.db = new Database(path, { create: true })
    this.db.exec(CREATE_NICKNAME_CACHE)
    this.db.exec(CREATE_CLAN_MEMBERS)
  }

  getCachedId(nickname: string): CachedNickname | null {
    const row = this.db
      .query<{ wt_id: string; matched_username: string }, [string]>(
        'SELECT wt_id, matched_username FROM nickname_id_cache WHERE nickname = ?',
      )
      .get(nickname)
    if (row === null) {
      return null
    }
    return { wtId: row.wt_id, matchedUsername: row.matched_username }
  }

  setCachedId(nickname: string, wtId: string, matchedUsername: string, resolvedAt: string): void {
    this.db.run(
      `INSERT INTO nickname_id_cache (nickname, wt_id, matched_username, resolved_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (nickname) DO UPDATE SET
         wt_id = excluded.wt_id,
         matched_username = excluded.matched_username,
         resolved_at = excluded.resolved_at`,
      [nickname, wtId, matchedUsername, resolvedAt],
    )
  }

  upsertClanMembers(squadron: string, members: ClanMember[], fetchedAt: string): void {
    const write = this.db.transaction((rows: ClanMember[]) => {
      for (const member of rows) {
        this.db.run(UPSERT_CLAN_MEMBER, [
          squadron,
          member.username,
          member.squadronRole,
          member.squadronJoinedAt,
          member.personalClanRating,
          member.activity,
          fetchedAt,
        ])
      }
    })
    write(members)
  }

  getClanMember(
    squadron: string,
    username: string,
  ): (ClanMember & { fetchedAt: string }) | null {
    const row = this.db
      .query<
        {
          username: string
          squadron_role: string | null
          squadron_joined_at: string
          personal_clan_rating: number | null
          activity: number | null
          fetched_at: string
        },
        [string, string]
      >(
        `SELECT username, squadron_role, squadron_joined_at, personal_clan_rating, activity, fetched_at
         FROM clan_members
         WHERE squadron = ? AND username = ?`,
      )
      .get(squadron, username)

    if (row === null) {
      return null
    }
    return {
      username: row.username,
      squadronRole: row.squadron_role,
      squadronJoinedAt: row.squadron_joined_at,
      personalClanRating: row.personal_clan_rating,
      activity: row.activity,
      fetchedAt: row.fetched_at,
    }
  }

  close(): void {
    this.db.close()
  }
}
