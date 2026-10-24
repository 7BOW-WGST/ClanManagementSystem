import type { APIGuild, APIGuildMember, APIUser } from 'discord-api-types/v10'
import type { GuildMemberRecord, RosterMember, RosterOutput } from './types'

export interface RosterFilterOptions {
  includeBots: boolean
  includePending: boolean
}

export interface FilteredRoster {
  members: APIGuildMember[]
  fetchedCount: number
  keptCount: number
  botCount: number
  pendingCount: number
}

export interface RosterOutputInput {
  guild: Pick<APIGuild, 'id' | 'name'>
  botUser: Pick<APIUser, 'id' | 'username'>
  fetchedAt: string
  fetchedCount: number
  keptCount: number
  botCount: number
  pendingCount: number
  members: GuildMemberRecord[]
}

// Exclude bots and pending humans by default. Counts always describe the full fetched roster.
export function filterRoster(
  members: APIGuildMember[],
  options: RosterFilterOptions,
): FilteredRoster {
  const botCount = members.filter((member) => member.user.bot === true).length
  const pendingCount = members.filter(
    (member) => member.user.bot !== true && member.pending === true,
  ).length

  const kept = members.filter((member) => {
    if (member.user.bot === true && !options.includeBots) {
      return false
    }
    if (member.pending === true && !options.includePending) {
      return false
    }
    return true
  })

  return {
    members: kept,
    fetchedCount: members.length,
    keptCount: kept.length,
    botCount,
    pendingCount,
  }
}

export function toGuildMemberRecord(
  member: APIGuildMember,
  timestamp: string,
): GuildMemberRecord {
  return {
    discord_id: member.user.id,
    username: member.user.username,
    server_name: member.nick ?? null,
    is_bot: member.user.bot === true,
    pending: member.pending === true,
    first_seen_at: timestamp,
    last_seen_at: timestamp,
  }
}

const collator = new Intl.Collator('pl', { sensitivity: 'base' })

// Deterministic order: display name, then username, then stable snowflake.
export function sortRosterMembers(members: RosterMember[]): RosterMember[] {
  return [...members].sort((left, right) => {
    const leftName = left.server_name ?? left.username
    const rightName = right.server_name ?? right.username
    return (
      collator.compare(leftName, rightName) ||
      collator.compare(left.username, right.username) ||
      left.discord_id.localeCompare(right.discord_id)
    )
  })
}

export function buildRosterOutput(input: RosterOutputInput): RosterOutput {
  const members = sortRosterMembers(
    input.members.map((member) => ({
      discord_id: member.discord_id,
      username: member.username,
      server_name: member.server_name,
    })),
  )

  return {
    meta: {
      guild_id: input.guild.id,
      guild_name: input.guild.name,
      fetched_at: input.fetchedAt,
      source: 'auto',
      bot_user_id: input.botUser.id,
      bot_user_name: input.botUser.username,
      fetched_count: input.fetchedCount,
      kept_count: input.keptCount,
      bot_count: input.botCount,
      pending_count: input.pendingCount,
    },
    members,
  }
}
