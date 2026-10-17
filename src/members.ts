import type { Kysely, Selectable } from 'kysely'
import { pickEffective } from './projection'
import type { Database, EventDatePrecision, MemberLifecycleEvent, MemberNicknameEvent } from './types'

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

// List all members with their derived (projected) nickname and status. Events are fetched in
// bulk to avoid a query per member (N+1).
export async function listMembers(db: Kysely<Database>): Promise<MemberSummary[]> {
  const members = await db.selectFrom('members').select('id').where('deleted_at', 'is', null).orderBy('id').execute()
  const nicknames = await db.selectFrom('member_nickname_events').selectAll().execute()
  const lifecycle = await db.selectFrom('member_lifecycle_events').selectAll().execute()

  return members.map((member) => ({
    id: member.id,
    nickname: pickEffective(nicknames.filter((row) => row.member_id === member.id))?.nickname ?? null,
    status: statusFromLifecycle(lifecycle.filter((row) => row.member_id === member.id)),
  }))
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
    .orderBy('event_date', 'asc')
    .orderBy('id', 'asc')
    .execute()

  const lifecycle = await db
    .selectFrom('member_lifecycle_events')
    .selectAll()
    .where('member_id', '=', id)
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
