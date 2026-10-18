import type { Kysely } from 'kysely'
import type { Database, EventDatePrecision, MembershipEventType } from '../db/types'
import { pickEffective } from '../lib/projection'

// Platforms that have a group membership stream.
export const groupPlatforms = ['discord', 'steam'] as const
export type GroupPlatform = (typeof groupPlatforms)[number]

// A group event row (normalised across the Discord/Steam tables).
export interface GroupEventRow {
  id: number
  type: MembershipEventType
  event_date: string | null
  event_date_precision: EventDatePrecision
  source: string
  recorded_at: Date
  deleted_at: Date | null
}

// Type guard narrowing a string to a platform with a group stream.
export function isGroupPlatform(value: string | undefined): value is GroupPlatform {
  return value !== undefined && groupPlatforms.some((platform) => platform === value)
}

// Fetch an account's group events for a platform (oldest first).
async function rawGroupEvents(
  db: Kysely<Database>,
  accountId: number,
  platform: GroupPlatform,
): Promise<GroupEventRow[]> {
  if (platform === 'discord') {
    return db
      .selectFrom('discord_group_events')
      .select(['id', 'type', 'event_date', 'event_date_precision', 'source', 'recorded_at', 'deleted_at'])
      .where('account_id', '=', accountId)
      .orderBy('event_date', 'asc')
      .orderBy('id', 'asc')
      .execute()
  }
  return db
    .selectFrom('steam_group_events')
    .select(['id', 'type', 'event_date', 'event_date_precision', 'source', 'recorded_at', 'deleted_at'])
    .where('account_id', '=', accountId)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()
}

// Record a group join/leave for an account.
export async function addGroupEvent(
  db: Kysely<Database>,
  input: { accountId: number; platform: GroupPlatform; type: MembershipEventType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  if (input.platform === 'discord') {
    await db
      .insertInto('discord_group_events')
      .values({ account_id: input.accountId, type: input.type, event_date: input.eventDate, event_date_precision: input.precision })
      .execute()
    return
  }
  await db
    .insertInto('steam_group_events')
    .values({ account_id: input.accountId, type: input.type, event_date: input.eventDate, event_date_precision: input.precision })
    .execute()
}

// Full group history for an account.
export function groupHistory(db: Kysely<Database>, accountId: number, platform: GroupPlatform): Promise<GroupEventRow[]> {
  return rawGroupEvents(db, accountId, platform)
}

// Whether the account is currently in the group.
export async function currentGroupMembership(
  db: Kysely<Database>,
  accountId: number,
  platform: GroupPlatform,
): Promise<boolean> {
  const events = await rawGroupEvents(db, accountId, platform)
  return pickEffective(events)?.type === 'join'
}
