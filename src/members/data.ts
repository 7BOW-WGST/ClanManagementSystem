import type { Kysely, Selectable } from 'kysely'
import type {
  Database,
  EventDatePrecision,
  MemberLifecycleEvent,
  MemberNicknameEvent,
  VeteranEvent,
  VeteranEventType,
} from '../db/types'
import type { ListOptions } from '../lib/pagination'
import { searchPattern } from '../lib/pagination'
import { pickEffective } from '../lib/projection'

// Derived membership status of a member.
export type MemberStatus = 'active' | 'left' | 'kicked' | 'unknown'

// Lifecycle event types allowed by the domain.
export const lifecycleTypes = ['join', 'leave', 'kick'] as const
export type LifecycleType = (typeof lifecycleTypes)[number]

// A stored nickname / lifecycle row (ids and defaults resolved by the database).
export type NicknameEvent = Selectable<MemberNicknameEvent>
export type LifecycleEvent = Selectable<MemberLifecycleEvent>

export interface MemberSummary {
  id: number
  nickname: string | null
  status: MemberStatus
}

export interface MemberDetail {
  id: number
  nickname: string | null
  status: MemberStatus
  nicknames: NicknameEvent[]
  lifecycle: LifecycleEvent[]
}

// Type guard narrowing a string to a known lifecycle type.
export function isLifecycleType(value: string | undefined): value is LifecycleType {
  return value !== undefined && lifecycleTypes.some((type) => type === value)
}

// Map the effective lifecycle event to a display status.
export function statusFromLifecycle(events: LifecycleEvent[]): MemberStatus {
  const effective = pickEffective(events)
  if (!effective) {
    return 'unknown'
  }
  if (effective.type === 'join') {
    return 'active'
  }
  if (effective.type === 'leave') {
    return 'left'
  }
  return 'kicked'
}

// List members with their derived (projected) nickname and status. Events for the listed page are
// fetched in bulk to avoid a query per member (N+1).
export async function listMembers(db: Kysely<Database>, options: ListOptions = {}): Promise<MemberSummary[]> {
  const pattern = searchPattern(options.search)

  let query = db.selectFrom('members').select('id').where('deleted_at', 'is', null)
  if (pattern) {
    // Match members whose current or historical nickname contains the search text.
    query = query.where('id', 'in', (eb) =>
      eb.selectFrom('member_nickname_events').select('member_id').where('nickname', 'ilike', pattern),
    )
  }

  const members = await query.orderBy('id').limit(options.limit ?? null).offset(options.offset ?? 0).execute()

  if (members.length === 0) {
    return []
  }

  const ids = members.map((member) => member.id)
  const nicknames = await db.selectFrom('member_nickname_events').selectAll().where('member_id', 'in', ids).execute()
  const lifecycle = await db.selectFrom('member_lifecycle_events').selectAll().where('member_id', 'in', ids).execute()

  return members.map((member) => ({
    id: member.id,
    nickname: pickEffective(nicknames.filter((row) => row.member_id === member.id))?.nickname ?? null,
    status: statusFromLifecycle(lifecycle.filter((row) => row.member_id === member.id)),
  }))
}

// Count live members (for pagination), optionally filtered by a nickname search.
export async function countMembers(db: Kysely<Database>, search?: string): Promise<number> {
  const pattern = searchPattern(search)

  let query = db.selectFrom('members').select((eb) => eb.fn.countAll().as('count')).where('deleted_at', 'is', null)
  if (pattern) {
    query = query.where('id', 'in', (eb) =>
      eb.selectFrom('member_nickname_events').select('member_id').where('nickname', 'ilike', pattern),
    )
  }

  const row = await query.executeTakeFirstOrThrow()
  return Number(row.count)
}

// Load a single member with its full nickname + lifecycle history, or undefined when not found.
export async function getMemberDetail(db: Kysely<Database>, id: number): Promise<MemberDetail | undefined> {
  const member = await db
    .selectFrom('members')
    .select('id')
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  if (!member) {
    return undefined
  }

  const nicknames = await db
    .selectFrom('member_nickname_events')
    .selectAll()
    .where('member_id', '=', id)
    .where('deleted_at', 'is', null)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()

  const lifecycle = await db
    .selectFrom('member_lifecycle_events')
    .selectAll()
    .where('member_id', '=', id)
    .where('deleted_at', 'is', null)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return {
    id: member.id,
    nickname: pickEffective(nicknames)?.nickname ?? null,
    status: statusFromLifecycle(lifecycle),
    nicknames,
    lifecycle,
  }
}

// Create a member (identity row) and, optionally, its first nickname event.
export async function createMember(
  db: Kysely<Database>,
  input: { nickname: string | null; eventDate: string | null; precision: EventDatePrecision },
): Promise<number> {
  const member = await db.insertInto('members').values({ source: 'manual' }).returning('id').executeTakeFirstOrThrow()

  if (input.nickname !== null) {
    await db
      .insertInto('member_nickname_events')
      .values({
        member_id: member.id,
        nickname: input.nickname,
        event_date: input.eventDate,
        event_date_precision: input.precision,
      })
      .execute()
  }

  return member.id
}

// Append a nickname event to a member.
export async function addNicknameEvent(
  db: Kysely<Database>,
  input: { memberId: number; nickname: string; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('member_nickname_events')
    .values({
      member_id: input.memberId,
      nickname: input.nickname,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}

// Append a lifecycle event (join / leave / kick) to a member.
export async function addLifecycleEvent(
  db: Kysely<Database>,
  input: { memberId: number; type: LifecycleType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('member_lifecycle_events')
    .values({
      member_id: input.memberId,
      type: input.type,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}

// Record a veteran status change (granted / removed).
export async function addVeteranEvent(
  db: Kysely<Database>,
  input: { memberId: number; type: VeteranEventType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .insertInto('veteran_events')
    .values({
      member_id: input.memberId,
      type: input.type,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
}

// Whether the member is currently a veteran: an active member whose latest veteran event is "granted".
export async function currentVeteran(db: Kysely<Database>, memberId: number): Promise<boolean> {
  const lifecycle: LifecycleEvent[] = await db
    .selectFrom('member_lifecycle_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .execute()
  if (statusFromLifecycle(lifecycle) !== 'active') {
    return false
  }

  const events = await db.selectFrom('veteran_events').selectAll().where('member_id', '=', memberId).execute()
  return pickEffective(events)?.type === 'granted'
}

// A member's veteran history (oldest first, deleted excluded).
export async function veteranEvents(db: Kysely<Database>, memberId: number): Promise<Selectable<VeteranEvent>[]> {
  return db
    .selectFrom('veteran_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .where('deleted_at', 'is', null)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()
}

// Correct a nickname event in place (value + date).
export async function correctNicknameEvent(
  db: Kysely<Database>,
  input: { eventId: number; nickname: string; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .updateTable('member_nickname_events')
    .set({ nickname: input.nickname, event_date: input.eventDate, event_date_precision: input.precision })
    .where('id', '=', input.eventId)
    .execute()
}

// Correct a lifecycle event in place (type + date).
export async function correctLifecycleEvent(
  db: Kysely<Database>,
  input: { eventId: number; type: LifecycleType; eventDate: string | null; precision: EventDatePrecision },
): Promise<void> {
  await db
    .updateTable('member_lifecycle_events')
    .set({ type: input.type, event_date: input.eventDate, event_date_precision: input.precision })
    .where('id', '=', input.eventId)
    .execute()
}

// Soft-delete a nickname / lifecycle / veteran event (retained for audit, excluded from derivation).
export async function softDeleteNicknameEvent(db: Kysely<Database>, eventId: number): Promise<void> {
  await db.updateTable('member_nickname_events').set({ deleted_at: new Date() }).where('id', '=', eventId).execute()
}

export async function softDeleteLifecycleEvent(db: Kysely<Database>, eventId: number): Promise<void> {
  await db.updateTable('member_lifecycle_events').set({ deleted_at: new Date() }).where('id', '=', eventId).execute()
}

export async function softDeleteVeteranEvent(db: Kysely<Database>, eventId: number): Promise<void> {
  await db.updateTable('veteran_events').set({ deleted_at: new Date() }).where('id', '=', eventId).execute()
}

// Warnings for an inconsistent lifecycle sequence (accepted, surfaced to the admin).
export async function lifecycleWarnings(db: Kysely<Database>, memberId: number): Promise<string[]> {
  const events = await db
    .selectFrom('member_lifecycle_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .where('deleted_at', 'is', null)
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()

  const warnings: string[] = []
  let active = false
  for (const event of events) {
    if (event.type === 'join') {
      if (active) {
        warnings.push('A join was recorded while the member was already active.')
      }
      active = true
    } else {
      if (!active) {
        warnings.push('A leave/kick was recorded while the member was not active.')
      }
      active = false
    }
  }
  return warnings
}

// A chronological entry in the member timeline.
export interface TimelineEntry {
  key: string
  date: string | null
  precision: EventDatePrecision
  label: string
  kind: 'lifecycle' | 'nickname' | 'rank' | 'veteran'
  eventId: number
}

// Merge the core member event streams into a single chronological timeline.
export function buildTimeline(input: {
  nicknames: Selectable<MemberNicknameEvent>[]
  lifecycle: Selectable<MemberLifecycleEvent>[]
  ranks: Array<{ id: number; rankName: string; event_date: string | null; event_date_precision: EventDatePrecision }>
  veterans: Array<{ id: number; type: string; event_date: string | null; event_date_precision: EventDatePrecision }>
}): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  for (const event of input.lifecycle) {
    entries.push({ key: `lifecycle-${event.id}`, date: event.event_date, precision: event.event_date_precision, label: event.type, kind: 'lifecycle', eventId: event.id })
  }
  for (const event of input.nicknames) {
    entries.push({ key: `nickname-${event.id}`, date: event.event_date, precision: event.event_date_precision, label: event.nickname, kind: 'nickname', eventId: event.id })
  }
  for (const entry of input.ranks) {
    entries.push({ key: `rank-${entry.id}`, date: entry.event_date, precision: entry.event_date_precision, label: entry.rankName, kind: 'rank', eventId: entry.id })
  }
  for (const event of input.veterans) {
    entries.push({ key: `veteran-${event.id}`, date: event.event_date, precision: event.event_date_precision, label: `veteran ${event.type}`, kind: 'veteran', eventId: event.id })
  }

  return entries.sort((a, b) => {
    const aDate = a.date ?? '9999-12-31'
    const bDate = b.date ?? '9999-12-31'
    if (aDate !== bDate) {
      return aDate < bDate ? -1 : 1
    }
    return a.key < b.key ? -1 : 1
  })
}
