import { describe, expect, test } from 'bun:test'
import { GuildMemberFlags, type APIGuildMember } from 'discord-api-types/v10'
import {
  buildRosterOutput,
  filterRoster,
  matchingRoleIds,
  sortRosterMembers,
  toGuildMemberRecord,
} from './roster'

const MEMBER_ROLE = '526133207339368459'
const VETERAN_ROLE = '827554967103340585'
const OTHER_ROLE = '111111111111111111'
const REQUIRED_ROLES = [MEMBER_ROLE, VETERAN_ROLE]

function member(input: {
  id: string
  username: string
  nick?: string | null
  globalName?: string | null
  joinedAt?: string | null
  roles?: string[]
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
    roles: input.roles ?? [],
    joined_at: input.joinedAt ?? '2024-01-01T00:00:00.000Z',
    deaf: false,
    mute: false,
    flags: 0 as GuildMemberFlags,
    pending: input.pending,
  }
}

describe('matchingRoleIds', () => {
  test('returns only qualifying roles, in configured order', () => {
    const roles = matchingRoleIds(
      member({
        id: '1',
        username: 'player',
        roles: [OTHER_ROLE, VETERAN_ROLE, MEMBER_ROLE],
      }),
      REQUIRED_ROLES,
    )

    expect(roles).toEqual([MEMBER_ROLE, VETERAN_ROLE])
  })
})

describe('filterRoster', () => {
  test('keeps humans with either qualifying role and excludes everything else', () => {
    const result = filterRoster(
      [
        member({ id: '1', username: 'member', roles: [MEMBER_ROLE] }),
        member({ id: '2', username: 'veteran', roles: [VETERAN_ROLE] }),
        member({ id: '3', username: 'both', roles: [MEMBER_ROLE, VETERAN_ROLE] }),
        member({ id: '4', username: 'other', roles: [OTHER_ROLE] }),
        member({ id: '5', username: 'bot', roles: [MEMBER_ROLE], bot: true }),
        member({ id: '6', username: 'pending', roles: [MEMBER_ROLE], pending: true }),
      ],
      { includeBots: false, includePending: false, memberRoleIds: REQUIRED_ROLES },
    )

    expect(result.fetchedCount).toBe(6)
    expect(result.keptCount).toBe(3)
    expect(result.botCount).toBe(1)
    expect(result.pendingCount).toBe(1)
    expect(result.roleFilteredCount).toBe(1)
    expect(result.members.map((entry) => entry.user.id)).toEqual(['1', '2', '3'])
  })

  test('include flags still require a qualifying role', () => {
    const result = filterRoster(
      [
        member({ id: '1', username: 'member', roles: [MEMBER_ROLE] }),
        member({ id: '2', username: 'bot', roles: [MEMBER_ROLE], bot: true }),
        member({ id: '3', username: 'pending', roles: [MEMBER_ROLE], pending: true }),
        member({ id: '4', username: 'other', roles: [OTHER_ROLE] }),
      ],
      { includeBots: true, includePending: true, memberRoleIds: REQUIRED_ROLES },
    )

    expect(result.keptCount).toBe(3)
    expect(result.roleFilteredCount).toBe(1)
    expect(result.members.map((entry) => entry.user.id)).toEqual(['1', '2', '3'])
  })
})

describe('toGuildMemberRecord', () => {
  test('keeps missing optional values as null', () => {
    const record = toGuildMemberRecord(
      member({ id: '1', username: 'player' }),
      '2026-01-01T00:00:00.000Z',
      [],
    )

    expect(record).toEqual({
      discord_id: '1',
      username: 'player',
      global_name: null,
      server_name: null,
      joined_at: '2024-01-01T00:00:00.000Z',
      matched_role_ids: [],
      is_bot: false,
      pending: false,
      first_seen_at: '2026-01-01T00:00:00.000Z',
      last_seen_at: '2026-01-01T00:00:00.000Z',
    })
  })

  test('maps the global name, join timestamp, and matched roles', () => {
    const record = toGuildMemberRecord(
      member({
        id: '1',
        username: 'player',
        globalName: 'Player Display',
        nick: 'Server Nick',
        joinedAt: '2024-02-03T04:05:06.000000+00:00',
      }),
      '2026-01-01T00:00:00.000Z',
      [MEMBER_ROLE],
    )

    expect(record.global_name).toBe('Player Display')
    expect(record.server_name).toBe('Server Nick')
    expect(record.joined_at).toBe('2024-02-03T04:05:06.000000+00:00')
    expect(record.matched_role_ids).toEqual([MEMBER_ROLE])
  })
})

describe('sortRosterMembers', () => {
  test('orders by server name, falling back to username', () => {
    const sorted = sortRosterMembers([
      {
        discord_id: '3',
        username: 'zeta',
        global_name: null,
        server_name: null,
        joined_at: null,
        matched_role_ids: [],
      },
      {
        discord_id: '1',
        username: 'alpha',
        global_name: null,
        server_name: 'Zulu',
        joined_at: null,
        matched_role_ids: [],
      },
      {
        discord_id: '2',
        username: 'beta',
        global_name: null,
        server_name: 'Alfa',
        joined_at: null,
        matched_role_ids: [],
      },
    ])

    expect(sorted.map((entry) => entry.discord_id)).toEqual(['2', '3', '1'])
  })
})

describe('buildRosterOutput', () => {
  test('builds the roster shape with role metadata', () => {
    const output = buildRosterOutput({
      guild: { id: 'guild-1', name: '7BOW' },
      botUser: { id: 'bot-1', username: 'Harvester' },
      fetchedAt: '2026-01-01T00:00:00.000Z',
      fetchedCount: 2,
      keptCount: 1,
      botCount: 1,
      pendingCount: 0,
      roleFilteredCount: 1,
      requiredRoleIds: REQUIRED_ROLES,
      members: [
        {
          discord_id: '1',
          username: 'player',
          global_name: 'Player Display',
          server_name: 'Gracz',
          joined_at: '2024-01-01T00:00:00.000Z',
          matched_role_ids: [MEMBER_ROLE],
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
      role_filtered_count: 1,
      required_role_ids: REQUIRED_ROLES,
    })
    expect(output.members).toEqual([
      {
        discord_id: '1',
        username: 'player',
        global_name: 'Player Display',
        server_name: 'Gracz',
        joined_at: '2024-01-01T00:00:00.000Z',
        matched_role_ids: [MEMBER_ROLE],
      },
    ])
  })
})
