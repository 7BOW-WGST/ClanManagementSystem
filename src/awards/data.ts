import type { Kysely, Selectable } from 'kysely'
import type { Award, AwardEvent, Database, EventDatePrecision } from '../db/types'

export type AwardRow = Selectable<Award>
export type AwardEventRow = Selectable<AwardEvent>

// An active (held) award instance.
export interface ActiveAward {
  eventId: number
  awardId: number
  name: string
  category: string
  tierGroup: string | null
  tierLevel: string | null
  eventDate: string | null
  eventDatePrecision: EventDatePrecision
}

// A row in a member's award history.
export interface AwardHistoryEntry {
  id: number
  type: string
  name: string
  eventDate: string | null
  eventDatePrecision: EventDatePrecision
  reason: string | null
}

// All awards ordered by category then name (for the grant form).
export async function listAwards(db: Kysely<Database>): Promise<AwardRow[]> {
  return db.selectFrom('awards').selectAll().orderBy('category', 'asc').orderBy('name', 'asc').execute()
}

// Active instances: grants/upgrades not closed by a later revoke or upgrade.
async function activeInstances(db: Kysely<Database>, memberId: number): Promise<AwardEventRow[]> {
  const events = await db.selectFrom('award_events').selectAll().where('member_id', '=', memberId).execute()
  const closed = new Set(events.filter((event) => event.target_event_id !== null).map((event) => event.target_event_id))
  return events.filter((event) => (event.type === 'grant' || event.type === 'upgrade') && !closed.has(event.id))
}

// The awards a member currently holds.
export async function activeAwards(db: Kysely<Database>, memberId: number): Promise<ActiveAward[]> {
  const instances = await activeInstances(db, memberId)
  if (instances.length === 0) {
    return []
  }

  const awardIds = [...new Set(instances.map((instance) => instance.award_id))]
  const awards = await db.selectFrom('awards').selectAll().where('id', 'in', awardIds).execute()
  const byId = new Map(awards.map((award) => [award.id, award]))

  const result: ActiveAward[] = []
  for (const instance of instances) {
    const award = byId.get(instance.award_id)
    if (award) {
      result.push({
        eventId: instance.id,
        awardId: instance.award_id,
        name: award.name,
        category: award.category,
        tierGroup: award.tier_group,
        tierLevel: award.tier_level,
        eventDate: instance.event_date,
        eventDatePrecision: instance.event_date_precision,
      })
    }
  }
  return result
}

// A member's full award history (oldest first).
export async function awardHistory(db: Kysely<Database>, memberId: number): Promise<AwardHistoryEntry[]> {
  return db
    .selectFrom('award_events as event')
    .innerJoin('awards as award', 'award.id', 'event.award_id')
    .select([
      'event.id',
      'event.type',
      'award.name',
      'event.event_date as eventDate',
      'event.event_date_precision as eventDatePrecision',
      'event.reason',
    ])
    .where('event.member_id', '=', memberId)
    .orderBy('event.event_date', 'asc')
    .orderBy('event.id', 'asc')
    .execute()
}

// Grant an award. When the member already holds a degree of the same tier group, this becomes an
// upgrade that closes the lower degree. Returns an error message on a rule violation.
export async function grantAward(
  db: Kysely<Database>,
  input: { memberId: number; awardId: number; eventDate: string | null; precision: EventDatePrecision; reason: string | null },
): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    await trx.selectFrom('members').select('id').where('id', '=', input.memberId).forUpdate().executeTakeFirst()

    const award = await trx.selectFrom('awards').selectAll().where('id', '=', input.awardId).executeTakeFirst()
    if (!award) {
      return 'Award not found.'
    }
    if (award.requires_reason && (input.reason === null || input.reason === '')) {
      return 'A reason is required for this award.'
    }

    const instances = await activeInstances(trx, input.memberId)

    // A once-only or tiered award may not be held twice; unlimited awards may.
    if ((award.tier_group !== null || award.max_per_member === 1) && instances.some((instance) => instance.award_id === input.awardId)) {
      return 'The member already holds this award.'
    }

    if (award.tier_group !== null && instances.length > 0) {
      const awards = await trx
        .selectFrom('awards')
        .selectAll()
        .where('id', 'in', [...new Set(instances.map((instance) => instance.award_id))])
        .execute()
      const groupById = new Map(awards.map((candidate) => [candidate.id, candidate.tier_group]))
      const lower = instances.find((instance) => groupById.get(instance.award_id) === award.tier_group)
      if (lower) {
        await trx
          .insertInto('award_events')
          .values({
            member_id: input.memberId,
            award_id: input.awardId,
            type: 'upgrade',
            target_event_id: lower.id,
            event_date: input.eventDate,
            event_date_precision: input.precision,
            reason: input.reason,
          })
          .execute()
        return undefined
      }
    }

    await trx
      .insertInto('award_events')
      .values({
        member_id: input.memberId,
        award_id: input.awardId,
        type: 'grant',
        target_event_id: null,
        event_date: input.eventDate,
        event_date_precision: input.precision,
        reason: input.reason,
      })
      .execute()
    return undefined
  })
}

// Revoke a specific active award instance.
export async function revokeAward(
  db: Kysely<Database>,
  input: { memberId: number; instanceEventId: number; eventDate: string | null; precision: EventDatePrecision; reason: string | null },
): Promise<string | undefined> {
  return db.transaction().execute(async (trx) => {
    await trx.selectFrom('members').select('id').where('id', '=', input.memberId).forUpdate().executeTakeFirst()

    const instances = await activeInstances(trx, input.memberId)
    const instance = instances.find((candidate) => candidate.id === input.instanceEventId)
    if (!instance) {
      return 'The award is not active.'
    }

    await trx
      .insertInto('award_events')
      .values({
        member_id: input.memberId,
        award_id: instance.award_id,
        type: 'revoke',
        target_event_id: instance.id,
        event_date: input.eventDate,
        event_date_precision: input.precision,
        reason: input.reason,
      })
      .execute()
    return undefined
  })
}
