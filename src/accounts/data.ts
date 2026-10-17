import type { Kysely, Selectable } from 'kysely'
import type { Account, AccountNameEvent, Database, EventDatePrecision, Platform } from '../db/types'
import { pickEffective } from '../lib/projection'

// The four external platforms an account can belong to.
export const platforms = ['discord', 'warthunder', 'arma3units', 'steam'] as const

// A stored account / name row (ids and defaults resolved by the database).
export type AccountRow = Selectable<Account>
export type AccountNameEventRow = Selectable<AccountNameEvent>

export interface AccountSummary {
  id: number
  platform: Platform
  platform_id: string | null
  name: string | null
}

export interface AccountDetail {
  id: number
  platform: Platform
  platform_id: string | null
  created_event_date: string | null
  created_event_date_precision: EventDatePrecision | null
  name: string | null
  names: AccountNameEventRow[]
}

// Type guard narrowing a string to a known platform.
export function isPlatform(value: string | undefined): value is Platform {
  return value !== undefined && platforms.some((platform) => platform === value)
}

// Project the current display name from an account's name events.
export function currentName(events: AccountNameEventRow[]): string | null {
  return pickEffective(events)?.name ?? null
}

// List accounts with their derived current display name.
export async function listAccounts(db: Kysely<Database>): Promise<AccountSummary[]> {
  const accounts = await db.selectFrom('accounts').selectAll().where('deleted_at', 'is', null).orderBy('id').execute()
  const names = await db.selectFrom('account_name_events').selectAll().execute()

  return accounts.map((account) => ({
    id: account.id,
    platform: account.platform,
    platform_id: account.platform_id,
    name: currentName(names.filter((row) => row.account_id === account.id)),
  }))
}

// Load one account with its display-name history, or undefined when not found.
export async function getAccountDetail(db: Kysely<Database>, id: number): Promise<AccountDetail | undefined> {
  const account = await db
    .selectFrom('accounts')
    .selectAll()
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  if (!account) {
    return undefined
  }

  const names = await db
    .selectFrom('account_name_events')
    .selectAll()
    .where('account_id', '=', id)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return {
    id: account.id,
    platform: account.platform,
    platform_id: account.platform_id,
    created_event_date: account.created_event_date,
    created_event_date_precision: account.created_event_date_precision,
    name: currentName(names),
    names,
  }
}

// Check whether a (platform, platform_id) pair is already used by a live account.
export async function platformIdTaken(
  db: Kysely<Database>,
  platform: Platform,
  platformId: string,
): Promise<boolean> {
  const existing = await db
    .selectFrom('accounts')
    .select('id')
    .where('platform', '=', platform)
    .where('platform_id', '=', platformId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  return existing !== undefined
}

// Create an account (optional identifier, first display name, and created date).
export async function createAccount(
  db: Kysely<Database>,
  input: {
    platform: Platform
    platformId: string | null
    name: string | null
    nameDate: string | null
    namePrecision: EventDatePrecision
    createdDate: string | null
    createdPrecision: EventDatePrecision | null
  },
): Promise<number> {
  const account = await db
    .insertInto('accounts')
    .values({
      platform: input.platform,
      platform_id: input.platformId,
      created_event_date: input.createdDate,
      created_event_date_precision: input.createdPrecision,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  if (input.name !== null) {
    await db
      .insertInto('account_name_events')
      .values({
        account_id: account.id,
        name: input.name,
        event_date: input.nameDate,
        event_date_precision: input.namePrecision,
      })
      .execute()
  }

  return account.id
}

// Append a display-name event to an account.
export async function addAccountNameEvent(
  db: Kysely<Database>,
  input: { accountId: number; name: string; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('account_name_events')
    .values({
      account_id: input.accountId,
      name: input.name,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}
