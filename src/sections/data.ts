import type { Kysely, Selectable } from 'kysely'
import { activeLinksForMember } from '../accounts/data'
import type {
  Arma3SectionEvent,
  Database,
  EventDatePrecision,
  MembershipEventType,
  Section,
  Squadron,
  SquadronMembershipEvent,
} from '../db/types'
import { today } from '../lib/date'
import { pickEffective } from '../lib/projection'
import { statusFromLifecycle, type LifecycleEvent } from '../members/data'

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

// A section catalog row.
export type SectionRow = Selectable<Section>

// A suspension with its section name and derived active flag.
export interface SuspensionView {
  id: number
  sectionName: string
  startDate: string
  startDatePrecision: EventDatePrecision
  endDate: string | null
  endDatePrecision: EventDatePrecision | null
  reason: string
  active: boolean
}

// The section catalog.
export async function listSections(db: Kysely<Database>): Promise<SectionRow[]> {
  return db.selectFrom('sections').selectAll().orderBy('name', 'asc').execute()
}

// Overlap test treating a null end as infinity (requires known start dates).
function intervalsOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  return aStart < (bEnd ?? '9999-12-31') && bStart < (aEnd ?? '9999-12-31')
}

// Record a section suspension. Rejects an interval that overlaps an existing one.
export async function addSuspension(
  db: Kysely<Database>,
  input: {
    memberId: number
    sectionId: number
    startDate: string
    startPrecision: EventDatePrecision
    endDate: string | null
    endPrecision: EventDatePrecision | null
    reason: string
  },
): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    await trx.selectFrom('members').select('id').where('id', '=', input.memberId).forUpdate().executeTakeFirst()

    const existing = await trx
      .selectFrom('suspensions')
      .selectAll()
      .where('member_id', '=', input.memberId)
      .where('section_id', '=', input.sectionId)
      .where('deleted_at', 'is', null)
      .execute()
    if (existing.some((row) => intervalsOverlap(input.startDate, input.endDate, row.start_date, row.end_date))) {
      return 'This overlaps an existing suspension for the section.'
    }

    await trx
      .insertInto('suspensions')
      .values({
        member_id: input.memberId,
        section_id: input.sectionId,
        start_date: input.startDate,
        start_date_precision: input.startPrecision,
        end_date: input.endDate,
        end_date_precision: input.endPrecision,
        reason: input.reason,
      })
      .execute()
    return undefined
  })
}

// A member's suspensions (with section names and an active flag).
export async function suspensionViews(db: Kysely<Database>, memberId: number): Promise<SuspensionView[]> {
  const rows = await db
    .selectFrom('suspensions as suspension')
    .innerJoin('sections as section', 'section.id', 'suspension.section_id')
    .select([
      'suspension.id',
      'section.name as sectionName',
      'suspension.start_date as startDate',
      'suspension.start_date_precision as startDatePrecision',
      'suspension.end_date as endDate',
      'suspension.end_date_precision as endDatePrecision',
      'suspension.reason',
    ])
    .where('suspension.member_id', '=', memberId)
    .orderBy('suspension.start_date', 'asc')
    .execute()

  const now = today()
  return rows.map((row) => ({
    ...row,
    active: row.startDate <= now && (row.endDate === null || row.endDate >= now),
  }))
}

// A stored Arma 3 section event.
export type Arma3SectionEventRow = Selectable<Arma3SectionEvent>

// Record an Arma 3 section join/leave.
export async function addArma3SectionEvent(
  db: Kysely<Database>,
  input: { memberId: number; type: MembershipEventType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('arma3_section_events')
    .values({
      member_id: input.memberId,
      type: input.type,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}

// Full Arma 3 section history of a member.
export async function arma3SectionHistory(db: Kysely<Database>, memberId: number): Promise<Arma3SectionEventRow[]> {
  return db
    .selectFrom('arma3_section_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()
}

// Whether the member is currently active in the Arma 3 section (active member + latest event join).
export async function arma3SectionActive(db: Kysely<Database>, memberId: number): Promise<boolean> {
  const lifecycle: LifecycleEvent[] = await db
    .selectFrom('member_lifecycle_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .execute()
  if (statusFromLifecycle(lifecycle) !== 'active') {
    return false
  }

  const events = await arma3SectionHistory(db, memberId)
  return pickEffective(events)?.type === 'join'
}
