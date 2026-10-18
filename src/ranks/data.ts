import type { Kysely, Selectable } from 'kysely'
import type { Arma3PromotionEvent, CorePromotionEvent, Database, EventDatePrecision, Rank } from '../db/types'
import { pickEffective } from '../lib/projection'
import { currentMembershipStart } from '../members/data'

export type RankRow = Selectable<Rank>

// A promotion/demotion history entry with the rank name resolved.
export interface RankHistoryEntry {
  id: number
  rankName: string
  event_date: string | null
  event_date_precision: EventDatePrecision
}

// All ranks ordered by their catalog order.
export async function listRanks(db: Kysely<Database>): Promise<RankRow[]> {
  return db.selectFrom('ranks').selectAll().orderBy('order', 'asc').execute()
}

// Look up a rank by name.
export async function rankByName(db: Kysely<Database>, name: string): Promise<RankRow | undefined> {
  return db.selectFrom('ranks').selectAll().where('name', '=', name).executeTakeFirst()
}

// Record a core promotion or demotion. Rejects re-recording the current rank.
export async function addCorePromotionEvent(
  db: Kysely<Database>,
  input: { memberId: number; rankId: number; eventDate: string | null; precision: EventDatePrecision },
): Promise<string | undefined> {
  const current = await currentCoreRank(db, input.memberId)
  if (current && current.id === input.rankId) {
    return 'This is already the current rank.'
  }

  await db
    .insertInto('core_promotion_events')
    .values({
      member_id: input.memberId,
      rank_id: input.rankId,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
  return undefined
}

// Full core rank history (promotions and demotions).
export async function coreRankHistory(db: Kysely<Database>, memberId: number): Promise<RankHistoryEntry[]> {
  return db
    .selectFrom('core_promotion_events as promotion')
    .innerJoin('ranks as rank', 'rank.id', 'promotion.rank_id')
    .select([
      'promotion.id',
      'rank.name as rankName',
      'promotion.event_date',
      'promotion.event_date_precision',
    ])
    .where('promotion.member_id', '=', memberId)
    .where('promotion.deleted_at', 'is', null)
    .orderBy('promotion.event_date', 'asc')
    .orderBy('promotion.id', 'asc')
    .execute()
}

// Soft-delete a core promotion/demotion event.
export async function softDeleteCorePromotion(db: Kysely<Database>, eventId: number): Promise<void> {
  await db.updateTable('core_promotion_events').set({ deleted_at: new Date() }).where('id', '=', eventId).execute()
}

// The member's current core rank: the latest promotion within the current membership period,
// otherwise the entry rank (Elew), or null when the member is not active.
export async function currentCoreRank(db: Kysely<Database>, memberId: number): Promise<RankRow | null> {
  const { active, start } = await currentMembershipStart(db, memberId)
  if (!active) {
    return null
  }

  const promotions: Selectable<CorePromotionEvent>[] = await db
    .selectFrom('core_promotion_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .where('deleted_at', 'is', null)
    .execute()
  const scoped = start === null ? promotions : promotions.filter((event) => event.event_date === null || event.event_date >= start)

  const effective = pickEffective(scoped)
  if (effective) {
    return (await db.selectFrom('ranks').selectAll().where('id', '=', effective.rank_id).executeTakeFirst()) ?? null
  }

  return (await rankByName(db, 'Elew')) ?? null
}

// Record an Arma 3 promotion/demotion. Rejects re-recording the current rank.
export async function addArma3PromotionEvent(
  db: Kysely<Database>,
  input: { memberId: number; rankId: number; eventDate: string | null; precision: EventDatePrecision },
): Promise<string | undefined> {
  const current = await currentArma3Rank(db, input.memberId)
  if (current && current.id === input.rankId) {
    return 'This is already the current rank.'
  }

  await db
    .insertInto('arma3_promotion_events')
    .values({
      member_id: input.memberId,
      rank_id: input.rankId,
      event_date: input.eventDate,
      event_date_precision: input.precision,
    })
    .execute()
  return undefined
}

// Full Arma 3 rank history.
export async function arma3RankHistory(db: Kysely<Database>, memberId: number): Promise<RankHistoryEntry[]> {
  return db
    .selectFrom('arma3_promotion_events as promotion')
    .innerJoin('ranks as rank', 'rank.id', 'promotion.rank_id')
    .select([
      'promotion.id',
      'rank.name as rankName',
      'promotion.event_date',
      'promotion.event_date_precision',
    ])
    .where('promotion.member_id', '=', memberId)
    .orderBy('promotion.event_date', 'asc')
    .orderBy('promotion.id', 'asc')
    .execute()
}

// The member's current Arma 3 rank: the latest promotion, otherwise the entry rank (Elew).
export async function currentArma3Rank(db: Kysely<Database>, memberId: number): Promise<RankRow | null> {
  const promotions: Selectable<Arma3PromotionEvent>[] = await db
    .selectFrom('arma3_promotion_events')
    .selectAll()
    .where('member_id', '=', memberId)
    .execute()

  const effective = pickEffective(promotions)
  if (effective) {
    return (await db.selectFrom('ranks').selectAll().where('id', '=', effective.rank_id).executeTakeFirst()) ?? null
  }

  return (await rankByName(db, 'Elew')) ?? null
}
