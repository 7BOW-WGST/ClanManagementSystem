import type { Kysely, Selectable } from 'kysely'
import { activeLinksForMember } from '../accounts/data'
import type { Database, EventDatePrecision, MembershipEventType, Squadron, SquadronMembershipEvent } from '../db/types'
import { pickEffective } from '../lib/projection'

// The War Thunder squadrons a member's account can belong to.
export const squadrons = ['7BOW', '7BOWs', '7BOWr'] as const

export type SquadronEvent = Selectable<SquadronMembershipEvent>

// Derived War Thunder membership of a member.
export interface WarThunderMembership {
  squadron: string | null
  conflict: boolean
}

// Type guard narrowing a string to a known squadron.
export function isSquadron(value: string | undefined): value is Squadron {
  return value !== undefined && squadrons.some((squadron) => squadron === value)
}

// Record a squadron join/leave event.
export async function addSquadronEvent(
  db: Kysely<Database>,
  input: { accountId: number; squadron: Squadron; type: MembershipEventType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('squadron_membership_events')
    .values({
      account_id: input.accountId,
      squadron: input.squadron,
      type: input.type,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}

// Full squadron history of an account.
export async function squadronHistoryForAccount(db: Kysely<Database>, accountId: number): Promise<SquadronEvent[]> {
  return db
    .selectFrom('squadron_membership_events')
    .selectAll()
    .where('account_id', '=', accountId)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()
}

// Current squadron of an account (latest join/leave), or null when not in a squadron.
export async function currentSquadronForAccount(db: Kysely<Database>, accountId: number): Promise<string | null> {
  const events = await squadronHistoryForAccount(db, accountId)
  const effective = pickEffective(events)
  if (!effective || effective.type === 'leave') {
    return null
  }
  return effective.squadron
}

// Derive a member's War Thunder membership from the squadron events of their active main/alt
// War Thunder accounts (borrowed links do not contribute).
export async function memberWarThunder(db: Kysely<Database>, memberId: number): Promise<WarThunderMembership> {
  const links = await activeLinksForMember(db, memberId)
  const candidateIds = links
    .filter((link) => link.relation === 'main' || link.relation === 'alt')
    .map((link) => link.accountId)
  if (candidateIds.length === 0) {
    return { squadron: null, conflict: false }
  }

  const accounts = await db
    .selectFrom('accounts')
    .select('id')
    .where('id', 'in', candidateIds)
    .where('platform', '=', 'warthunder')
    .where('deleted_at', 'is', null)
    .execute()
  const warThunderIds = accounts.map((account) => account.id)
  if (warThunderIds.length === 0) {
    return { squadron: null, conflict: false }
  }

  const events = await db
    .selectFrom('squadron_membership_events')
    .selectAll()
    .where('account_id', 'in', warThunderIds)
    .execute()

  const perAccount = new Set<string>()
  for (const id of warThunderIds) {
    const effective = pickEffective(events.filter((event) => event.account_id === id))
    if (effective && effective.type === 'join') {
      perAccount.add(effective.squadron)
    }
  }

  if (perAccount.size === 0) {
    return { squadron: null, conflict: false }
  }

  // The most recent squadron event decides; a conflict is flagged when accounts disagree.
  const effective = pickEffective(events)
  const squadron = effective && effective.type === 'join' ? effective.squadron : (perAccount.values().next().value ?? null)
  return { squadron, conflict: perAccount.size > 1 }
}
