// Shared types for the Discord roster harvester.

export interface HarvestConfig {
  botToken: string
  guildId: string
  memberRoleIds: string[]
  apiVersion: number
  pageSize: number
  cachePath: string
  outputPath: string
}

// A cached guild member row. Discord snowflakes are always stored as text.
export interface GuildMemberRecord {
  discord_id: string
  username: string
  global_name: string | null
  server_name: string | null
  joined_at: string | null
  matched_role_ids: string[]
  is_bot: boolean
  pending: boolean
  first_seen_at: string
  last_seen_at: string
}

// The minimal player-base shape written to output/discord-members.json.
export interface RosterMember {
  discord_id: string
  username: string
  global_name: string | null
  server_name: string | null
  joined_at: string | null
  matched_role_ids: string[]
}

export interface RosterMeta {
  guild_id: string
  guild_name: string
  fetched_at: string
  source: 'auto'
  bot_user_id: string
  bot_user_name: string
  fetched_count: number
  kept_count: number
  bot_count: number
  pending_count: number
  role_filtered_count: number
  required_role_ids: string[]
}

export interface RosterOutput {
  meta: RosterMeta
  members: RosterMember[]
}

export interface FetchMembersOptions {
  limit?: number
}
