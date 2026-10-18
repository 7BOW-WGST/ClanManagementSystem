import type { Kysely, Selectable } from 'kysely'
import type {
  Account,
  AccountLinkEvent,
  AccountNameEvent,
  Database,
  EventDatePrecision,
  Platform,
  Relation,
} from '../db/types'
import type { ListOptions } from '../lib/pagination'
import { searchPattern } from '../lib/pagination'
import { pickEffective } from '../lib/projection'
import { listMembers } from '../members/data'

// The four external platforms an account can belong to.
export const platforms = ['discord', 'warthunder', 'arma3units', 'steam'] as const

// A stored account / name / link row (ids and defaults resolved by the database).
export type AccountRow = Selectable<Account>
export type AccountNameEventRow = Selectable<AccountNameEvent>
export type AccountLinkEventRow = Selectable<AccountLinkEvent>

// The set of War Thunder relations (see DECISIONS R2).
export const relations = ['main', 'alt', 'borrowed'] as const

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

// An active member <-> account link.
export interface ActiveLink {
  accountId: number
  memberId: number
  relation: Relation | null
}

// An active link of an account, with the member's display label.
export interface AccountLinkView {
  memberId: number
  memberNickname: string | null
  relation: Relation | null
}

// An active account of a member, with the account's display data.
export interface MemberAccountView {
  accountId: number
  platform: Platform
  platformId: string | null
  name: string | null
  relation: Relation | null
}

export interface LinkInput {
  accountId: number
  memberId: number
  relation: Relation | null
  eventDate: string | null
  precision: EventDatePrecision
}

// Type guard narrowing a string to a known platform.
export function isPlatform(value: string | undefined): value is Platform {
  return value !== undefined && platforms.some((platform) => platform === value)
}

// Type guard narrowing a string to a known War Thunder relation.
export function isRelation(value: string | undefined): value is Relation {
  return value !== undefined && relations.some((relation) => relation === value)
}

// Project the current display name from an account's name events.
export function currentName(events: AccountNameEventRow[]): string | null {
  return pickEffective(events)?.name ?? null
}

// List accounts with their derived current display name.
export async function listAccounts(db: Kysely<Database>, options: ListOptions = {}): Promise<AccountSummary[]> {
  const pattern = searchPattern(options.search)

  let query = db.selectFrom('accounts').selectAll().where('deleted_at', 'is', null)
  if (pattern) {
    query = query.where((eb) =>
      eb.or([
        eb('platform_id', 'ilike', pattern),
        eb('id', 'in', (sub) => sub.selectFrom('account_name_events').select('account_id').where('name', 'ilike', pattern)),
      ]),
    )
  }

  const accounts = await query.orderBy('id').limit(options.limit ?? null).offset(options.offset ?? 0).execute()

  if (accounts.length === 0) {
    return []
  }

  const ids = accounts.map((account) => account.id)
  const names = await db.selectFrom('account_name_events').selectAll().where('account_id', 'in', ids).execute()

  return accounts.map((account) => ({
    id: account.id,
    platform: account.platform,
    platform_id: account.platform_id,
    name: currentName(names.filter((row) => row.account_id === account.id)),
  }))
}

// Count live accounts (for pagination), optionally filtered by identifier or name.
export async function countAccounts(db: Kysely<Database>, search?: string): Promise<number> {
  const pattern = searchPattern(search)

  let query = db.selectFrom('accounts').select((eb) => eb.fn.countAll().as('count')).where('deleted_at', 'is', null)
  if (pattern) {
    query = query.where((eb) =>
      eb.or([
        eb('platform_id', 'ilike', pattern),
        eb('id', 'in', (sub) => sub.selectFrom('account_name_events').select('account_id').where('name', 'ilike', pattern)),
      ]),
    )
  }

  const row = await query.executeTakeFirstOrThrow()
  return Number(row.count)
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
export async function platformIdTaken(db: Kysely<Database>, platform: Platform, platformId: string): Promise<boolean> {
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

// Group link events by stream (account + member) and keep the active ones (latest action is not an unlink).
function activeLinkStates(events: AccountLinkEventRow[]): ActiveLink[] {
  const byStream = new Map<string, AccountLinkEventRow[]>()
  for (const event of events) {
    const key = `${event.account_id}:${event.member_id}`
    const list = byStream.get(key) ?? []
    list.push(event)
    byStream.set(key, list)
  }

  const active: ActiveLink[] = []
  for (const list of byStream.values()) {
    const effective = pickEffective(list)
    if (effective && effective.action !== 'unlink') {
      active.push({ accountId: effective.account_id, memberId: effective.member_id, relation: effective.relation })
    }
  }
  return active
}

// Active links of an account.
export async function activeLinksForAccount(db: Kysely<Database>, accountId: number): Promise<ActiveLink[]> {
  const events = await db.selectFrom('account_link_events').selectAll().where('account_id', '=', accountId).execute()
  return activeLinkStates(events)
}

// Active links of a member (across all accounts).
export async function activeLinksForMember(db: Kysely<Database>, memberId: number): Promise<ActiveLink[]> {
  const events = await db.selectFrom('account_link_events').selectAll().where('member_id', '=', memberId).execute()
  return activeLinkStates(events)
}

// Active links of an account with the member's current nickname.
export async function accountLinkViews(db: Kysely<Database>, accountId: number): Promise<AccountLinkView[]> {
  const links = await activeLinksForAccount(db, accountId)
  const members = await listMembers(db)
  const nicknameById = new Map(members.map((member) => [member.id, member.nickname]))

  return links.map((link) => ({
    memberId: link.memberId,
    memberNickname: nicknameById.get(link.memberId) ?? null,
    relation: link.relation,
  }))
}

// Active accounts of a member with each account's display data.
export async function memberAccountViews(db: Kysely<Database>, memberId: number): Promise<MemberAccountView[]> {
  const links = await activeLinksForMember(db, memberId)
  const accountIds = [...new Set(links.map((link) => link.accountId))]
  if (accountIds.length === 0) {
    return []
  }

  const accounts = await db
    .selectFrom('accounts')
    .selectAll()
    .where('id', 'in', accountIds)
    .where('deleted_at', 'is', null)
    .execute()
  const names = await db.selectFrom('account_name_events').selectAll().where('account_id', 'in', accountIds).execute()

  return accounts.map((account) => ({
    accountId: account.id,
    platform: account.platform,
    platformId: account.platform_id,
    name: currentName(names.filter((row) => row.account_id === account.id)),
    relation: links.find((link) => link.accountId === account.id)?.relation ?? null,
  }))
}

// Validate a proposed relation against the constraints in R3/R9.
async function relationError(
  db: Kysely<Database>,
  account: AccountRow,
  memberId: number,
  relation: Relation | null,
): Promise<string | undefined> {
  const isWarThunder = account.platform === 'warthunder'

  if (!isWarThunder && relation !== null) {
    return 'Relations apply to War Thunder accounts only.'
  }
  if (isWarThunder && relation === null) {
    return 'Choose a War Thunder relation (main, alt or borrowed).'
  }

  // Non-War Thunder accounts may have at most one active member.
  if (!isWarThunder) {
    const links = await activeLinksForAccount(db, account.id)
    if (links.some((link) => link.memberId !== memberId)) {
      return 'This account is already linked to another member.'
    }
  }

  // A War Thunder account may have at most one main/alt link.
  if (relation === 'main' || relation === 'alt') {
    const links = await activeLinksForAccount(db, account.id)
    if (links.some((link) => link.memberId !== memberId && (link.relation === 'main' || link.relation === 'alt'))) {
      return 'This account already has a main or alt relation.'
    }
  }

  // A member may hold at most one main account.
  if (relation === 'main') {
    const links = await activeLinksForMember(db, memberId)
    if (links.some((link) => link.accountId !== account.id && link.relation === 'main')) {
      return 'This member already has a main account.'
    }
  }

  return undefined
}

// Link an account to a member (transactional, with a row lock to serialize concurrent edits).
export async function linkAccount(db: Kysely<Database>, input: LinkInput): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    const account = await trx
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', input.accountId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!account) {
      return 'Account not found.'
    }
    await trx.selectFrom('members').select('id').where('id', '=', input.memberId).forUpdate().executeTakeFirst()

    const links = await activeLinksForAccount(trx, input.accountId)
    if (links.some((link) => link.memberId === input.memberId)) {
      return 'This member is already linked to the account.'
    }

    const error = await relationError(trx, account, input.memberId, input.relation)
    if (error) {
      return error
    }

    await trx
      .insertInto('account_link_events')
      .values({
        account_id: input.accountId,
        member_id: input.memberId,
        action: 'link',
        relation: input.relation,
        event_date: input.eventDate,
        event_date_precision: input.precision,
      })
      .execute()
    return undefined
  })
}

// Change the relation of an existing member link.
export async function changeRelation(db: Kysely<Database>, input: LinkInput): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    const account = await trx
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', input.accountId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!account) {
      return 'Account not found.'
    }

    const links = await activeLinksForAccount(trx, input.accountId)
    if (!links.some((link) => link.memberId === input.memberId)) {
      return 'The member is not linked to the account.'
    }

    const error = await relationError(trx, account, input.memberId, input.relation)
    if (error) {
      return error
    }

    await trx
      .insertInto('account_link_events')
      .values({
        account_id: input.accountId,
        member_id: input.memberId,
        action: 'relation_change',
        relation: input.relation,
        event_date: input.eventDate,
        event_date_precision: input.precision,
      })
      .execute()
    return undefined
  })
}

// Unlink an account from a member (recorded as an event so history is preserved).
export async function unlinkAccount(
  db: Kysely<Database>,
  input: { accountId: number; memberId: number; eventDate: string | null; precision: EventDatePrecision },
): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    const account = await trx
      .selectFrom('accounts')
      .select('id')
      .where('id', '=', input.accountId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!account) {
      return 'Account not found.'
    }

    const links = await activeLinksForAccount(trx, input.accountId)
    if (!links.some((link) => link.memberId === input.memberId)) {
      return 'The member is not linked to the account.'
    }

    await trx
      .insertInto('account_link_events')
      .values({
        account_id: input.accountId,
        member_id: input.memberId,
        action: 'unlink',
        relation: null,
        event_date: input.eventDate,
        event_date_precision: input.precision,
      })
      .execute()
    return undefined
  })
}

// Derive the active links that would exist after merging the duplicate into the canonical account.
async function mergedActiveLinks(
  db: Kysely<Database>,
  canonicalId: number,
  duplicateId: number,
): Promise<ActiveLink[]> {
  const events = await db
    .selectFrom('account_link_events')
    .selectAll()
    .where('account_id', 'in', [canonicalId, duplicateId])
    .execute()
  return activeLinkStates(events.map((event) => ({ ...event, account_id: canonicalId })))
}

// Check whether merging would violate the current-state relation constraints (R3/R9).
async function mergeConflict(
  db: Kysely<Database>,
  canonical: AccountRow,
  duplicateId: number,
  links: ActiveLink[],
): Promise<string | undefined> {
  if (canonical.platform === 'warthunder') {
    const mainAlt = links.filter((link) => link.relation === 'main' || link.relation === 'alt')
    if (mainAlt.length > 1) {
      return 'The merge would create more than one main/alt link on the account.'
    }
    for (const link of links.filter((candidate) => candidate.relation === 'main')) {
      const memberLinks = await activeLinksForMember(db, link.memberId)
      if (
        memberLinks.some(
          (candidate) =>
            candidate.relation === 'main' && candidate.accountId !== canonical.id && candidate.accountId !== duplicateId,
        )
      ) {
        return 'The merge would create a second main account for a member.'
      }
    }
  } else if (links.length > 1) {
    return 'The merge would link the account to more than one member.'
  }

  return undefined
}

// Merge a duplicate account into a canonical account: re-point history, retire the duplicate,
// and record the merge. Blocked when it would violate current-state constraints.
export async function mergeAccounts(
  db: Kysely<Database>,
  input: { canonicalId: number; duplicateId: number; reason: string | null },
): Promise<string | undefined> {
  if (input.canonicalId === input.duplicateId) {
    return 'Choose two different accounts.'
  }

  return db.transaction().execute(async (trx) => {
    // Lock both accounts in a stable order to avoid deadlocks.
    const ids = [input.canonicalId, input.duplicateId].sort((a, b) => a - b)
    const locked = await trx
      .selectFrom('accounts')
      .selectAll()
      .where('id', 'in', ids)
      .where('deleted_at', 'is', null)
      .orderBy('id')
      .forUpdate()
      .execute()
    if (locked.length !== 2) {
      return 'Account not found.'
    }
    const canonical = locked.find((account) => account.id === input.canonicalId)
    if (!canonical) {
      return 'Account not found.'
    }

    const conflict = await mergeConflict(trx, canonical, input.duplicateId, await mergedActiveLinks(trx, input.canonicalId, input.duplicateId))
    if (conflict) {
      return conflict
    }

    // Re-point history to the canonical account.
    await trx
      .updateTable('account_name_events')
      .set({ account_id: input.canonicalId })
      .where('account_id', '=', input.duplicateId)
      .execute()
    await trx
      .updateTable('account_link_events')
      .set({ account_id: input.canonicalId })
      .where('account_id', '=', input.duplicateId)
      .execute()

    // Retire the duplicate and record the merge.
    await trx.updateTable('accounts').set({ deleted_at: new Date() }).where('id', '=', input.duplicateId).execute()
    await trx
      .insertInto('account_merge_audit')
      .values({
        canonical_account_id: input.canonicalId,
        merged_account_id: input.duplicateId,
        reason: input.reason,
      })
      .execute()

    return undefined
  })
}
