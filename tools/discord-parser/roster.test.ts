import { describe, expect, test } from 'bun:test'
import { GuildMemberFlags, type APIGuildMember } from 'discord-api-types/v10'
import {
  buildRosterOutput,
  filterRoster,
  sortRosterMembers,
  toGuildMemberRecord,
} from './roster'

function member(input: {
  id: string
  username: string
  nick?: string | null
  globalName?: string | null
  joinedAt?: string | null
  bot?: boolean
  pending?: boolean
}): APIGuildMember {
  return {
    user: {
      id: input.id,
      username: input.username,
      discriminator: '0',
      global_name: input.globalName ?? null,
      avatar: null,
      bot: input.bot,
    },
    nick: input.nick ?? null,
    roles: [],
    joined_at: input.joinedAt ?? '2024-01-01T00:00:00.000Z',
    deaf: false,
    mute: false,
    flags: 0 as GuildMemberFlags,
    pending: input.pending,
  }
}

describe('filterRoster', () => {
  test('excludes bots and pending humans by default', () => {
    const result = filterRoster(
      [
        member({ id: '1', username: 'player', nick: 'Gracz' }),
        member({ id: '2', username: 'bot', bot: true }),
        member({ id: '3', username: 'pending', pending: true }),
      ],
      { includeBots: false, includePending: false },
    )

    expect(result.fetchedCount).toBe(3)
    expect(result.keptCount).toBe(1)
    expect(result.botCount).toBe(1)
    expect(result.pendingCount).toBe(1)
    expect(result.members.map((entry) => entry.user.id)).toEqual(['1'])
  })

  test('can include bots and pending humans', () => {
    const result = filterRoster(
      [
        member({ id: '1', username: 'player' }),
        member({ id: '2', username: 'bot', bot: true }),
        member({ id: '3', username: 'pending', pending: true }),
      ],
      { includeBots: true, includePending: true },
    )

    expect(result.keptCount).toBe(3)
  })
})

describe('toGuildMemberRecord', () => {
  test('keeps a missing server nickname as null', () => {
    const record = toGuildMemberRecord(member({ id: '1', username: 'player' }), '2026-01-01T00:00:00.000Z')

    expect(record).toEqual({
      discord_id: '1',
      username: 'player',
      global_name: null,
      server_name: null,
      joined_at: '2024-01-01T00:00:00.000Z',
      is_bot: false,
      pending: false,
      first_seen_at: '2026-01-01T00:00:00.000Z',
      last_seen_at: '2026-01-01T00:00:00.000Z',
    })
  })

  test('maps the global name and server join timestamp', () => {
    const record = toGuildMemberRecord(
      member({
        id: '1',
        username: 'player',
        globalName: 'Player Display',
        nick: 'Server Nick',
        joinedAt: '2024-02-03T04:05:06.000000+00:00',
      }),
      '2026-01-01T00:00:00.000Z',
    )

    expect(record.global_name).toBe('Player Display')
    expect(record.server_name).toBe('Server Nick')
    expect(record.joined_at).toBe('2024-02-03T04:05:06.000000+00:00')
  })
})

describe('sortRosterMembers', () => {
  test('orders by server name, falling back to username', () => {
    const sorted = sortRosterMembers([
      { discord_id: '3', username: 'zeta', global_name: null, server_name: null, joined_at: null },
      { discord_id: '1', username: 'alpha', global_name: null, server_name: 'Zulu', joined_at: null },
      { discord_id: '2', username: 'beta', global_name: null, server_name: 'Alfa', joined_at: null },
    ])

    expect(sorted.map((entry) => entry.discord_id)).toEqual(['2', '3', '1'])
  })
})

describe('buildRosterOutput', () => {
  test('builds the minimal roster shape and metadata', () => {
    const output = buildRosterOutput({
      guild: { id: 'guild-1', name: '7BOW' },
      botUser: { id: 'bot-1', username: 'Harvester' },
      fetchedAt: '2026-01-01T00:00:00.000Z',
      fetchedCount: 2,
      keptCount: 1,
      botCount: 1,
      pendingCount: 0,
      members: [
        {
          discord_id: '1',
          username: 'player',
          global_name: 'Player Display',
          server_name: 'Gracz',
          joined_at: '2024-01-01T00:00:00.000Z',
          is_bot: false,
          pending: false,
          first_seen_at: '2026-01-01T00:00:00.000Z',
          last_seen_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    expect(output.meta).toEqual({
      guild_id: 'guild-1',
      guild_name: '7BOW',
      fetched_at: '2026-01-01T00:00:00.000Z',
      source: 'auto',
      bot_user_id: 'bot-1',
      bot_user_name: 'Harvester',
      fetched_count: 2,
      kept_count: 1,
      bot_count: 1,
      pending_count: 0,
    })
    expect(output.members).toEqual([
      {
        discord_id: '1',
        username: 'player',
        global_name: 'Player Display',
        server_name: 'Gracz',
        joined_at: '2024-01-01T00:00:00.000Z',
      },
    ])
  })
})
