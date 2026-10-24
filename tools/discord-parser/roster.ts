import type { APIGuild, APIGuildMember, APIUser } from 'discord-api-types/v10'
import type { GuildMemberRecord, RosterMember, RosterOutput } from './types'

export interface RosterFilterOptions {
  includeBots: boolean
  includePending: boolean
  memberRoleIds: readonly string[]
}

export interface FilteredRoster {
  members: APIGuildMember[]
  fetchedCount: number
  keptCount: number
  botCount: number
  pendingCount: number
  roleFilteredCount: number
}

export interface RosterOutputInput {
  guild: Pick<APIGuild, 'id' | 'name'>
  botUser: Pick<APIUser, 'id' | 'username'>
  fetchedAt: string
  fetchedCount: number
  keptCount: number
  botCount: number
  pendingCount: number
  roleFilteredCount: number
  requiredRoleIds: readonly string[]
  members: GuildMemberRecord[]
}

// Return the configured qualifying roles present on the member, in configured order.
export function matchingRoleIds(
  member: APIGuildMember,
  memberRoleIds: readonly string[],
): string[] {
  const roles = new Set(member.roles)
  return memberRoleIds.filter((roleId) => roles.has(roleId))
}

// Exclude bots, pending humans, and members without a qualifying role.
// Counts always describe the full fetched roster.
export function filterRoster(
  members: APIGuildMember[],
  options: RosterFilterOptions,
): FilteredRoster {
  const botCount = members.filter((member) => member.user.bot === true).length
  const pendingCount = members.filter(
    (member) => member.user.bot !== true && member.pending === true,
  ).length
  const nonBotNonPending = members.filter(
    (member) => member.user.bot !== true && member.pending !== true,
  )
  const roleFilteredCount = nonBotNonPending.filter(
    (member) => matchingRoleIds(member, options.memberRoleIds).length === 0,
  ).length

  const kept = members.filter((member) => {
    if (member.user.bot === true && !options.includeBots) {
      return false
    }
    if (member.pending === true && !options.includePending) {
      return false
    }
    return matchingRoleIds(member, options.memberRoleIds).length > 0
  })

  return {
    members: kept,
    fetchedCount: members.length,
    keptCount: kept.length,
    botCount,
    pendingCount,
    roleFilteredCount,
  }
}

export function toGuildMemberRecord(
  member: APIGuildMember,
  timestamp: string,
  matchedRoleIds: readonly string[],
): GuildMemberRecord {
  return {
    discord_id: member.user.id,
    username: member.user.username,
    global_name: member.user.global_name,
    server_name: member.nick ?? null,
    joined_at: member.joined_at,
    matched_role_ids: [...matchedRoleIds],
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
      global_name: member.global_name,
      server_name: member.server_name,
      joined_at: member.joined_at,
      matched_role_ids: [...member.matched_role_ids],
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
      role_filtered_count: input.roleFilteredCount,
      required_role_ids: [...input.requiredRoleIds],
    },
    members,
  }
}
