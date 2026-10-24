import { describe, expect, test } from 'bun:test'
import { RosterCache } from './cache'
import type { GuildMemberRecord } from './types'

function record(input: Partial<GuildMemberRecord> & Pick<GuildMemberRecord, 'discord_id' | 'username'>): GuildMemberRecord {
  return {
    server_name: null,
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
          server_name: 'New',
          first_seen_at: '2024-02-01T00:00:00.000Z',
          last_seen_at: '2024-02-01T00:00:00.000Z',
        }),
      ])

      const members = cache.listMembers('guild-1')
      expect(members).toHaveLength(1)
      expect(members[0]).toEqual({
        discord_id: '1',
        username: 'new-name',
        server_name: 'New',
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
})
