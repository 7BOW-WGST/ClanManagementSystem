import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RosterCache } from './cache'
import type { GuildMemberRecord } from './types'

function record(input: Partial<GuildMemberRecord> & Pick<GuildMemberRecord, 'discord_id' | 'username'>): GuildMemberRecord {
  return {
    global_name: null,
    server_name: null,
    joined_at: null,
    is_bot: false,
    pending: false,
    first_seen_at: '2024-01-01T00:00:00.000Z',
    last_seen_at: '2024-01-01T00:00:00.000Z',
    ...input,
  }
}

describe('RosterCache', () => {
  test('upserts members and preserves first_seen_at', () => {
    const cache = new RosterCache(':memory:')
    try {
      cache.upsertMembers('guild-1', [
        record({ discord_id: '1', username: 'old-name', server_name: 'Old' }),
      ])
      cache.upsertMembers('guild-1', [
        record({
          discord_id: '1',
          username: 'new-name',
          global_name: 'New Display',
          server_name: 'New',
          joined_at: '2023-05-06T07:08:09.000000+00:00',
          first_seen_at: '2024-02-01T00:00:00.000Z',
          last_seen_at: '2024-02-01T00:00:00.000Z',
        }),
      ])

      const members = cache.listMembers('guild-1')
      expect(members).toHaveLength(1)
      expect(members[0]).toEqual({
        discord_id: '1',
        username: 'new-name',
        global_name: 'New Display',
        server_name: 'New',
        joined_at: '2023-05-06T07:08:09.000000+00:00',
        is_bot: false,
        pending: false,
        first_seen_at: '2024-01-01T00:00:00.000Z',
        last_seen_at: '2024-02-01T00:00:00.000Z',
      })
    } finally {
      cache.close()
    }
  })

  test('stores bots and pending flags separately', () => {
    const cache = new RosterCache(':memory:')
    try {
      cache.upsertMembers('guild-1', [
        record({ discord_id: '2', username: 'bot', is_bot: true }),
        record({ discord_id: '3', username: 'pending', pending: true }),
      ])

      const members = cache.listMembers('guild-1')
      expect(members.map((entry) => [entry.discord_id, entry.is_bot, entry.pending])).toEqual([
        ['2', true, false],
        ['3', false, true],
      ])
    } finally {
      cache.close()
    }
  })

  test('adds the new columns to an existing cache', () => {
    const directory = mkdtempSync(join(tmpdir(), 'roster-cache-'))
    const path = join(directory, 'cache.sqlite')

    try {
      const old = new Database(path, { create: true })
      old.exec(`
        CREATE TABLE guild_members (
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          server_name TEXT,
          is_bot INTEGER NOT NULL,
          pending INTEGER NOT NULL,
          first_seen_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          PRIMARY KEY (guild_id, user_id)
        )
      `)
      old.run(
        `INSERT INTO guild_members (guild_id, user_id, username, server_name, is_bot, pending, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'guild-1',
          '1',
          'old-name',
          null,
          0,
          0,
          '2024-01-01T00:00:00.000Z',
          '2024-01-01T00:00:00.000Z',
        ],
      )
      old.close()

      const cache = new RosterCache(path)
      try {
        const before = cache.listMembers('guild-1')
        expect(before[0]?.global_name).toBeNull()
        expect(before[0]?.joined_at).toBeNull()

        cache.upsertMembers('guild-1', [
          record({
            discord_id: '1',
            username: 'new-name',
            global_name: 'New Display',
            joined_at: '2023-05-06T07:08:09.000000+00:00',
            last_seen_at: '2024-02-01T00:00:00.000Z',
          }),
        ])

        const after = cache.listMembers('guild-1')
        expect(after[0]?.global_name).toBe('New Display')
        expect(after[0]?.joined_at).toBe('2023-05-06T07:08:09.000000+00:00')
      } finally {
        cache.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
