import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { setFlash } from '../lib/flash'
import { requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { addArma3PromotionEvent, addCorePromotionEvent } from './data'

// Router for rank routes (mounted at the application root).
export const rankRoutes = new Hono()

// Parse a member id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Record a core promotion or demotion.
rankRoutes.post('/members/:id/promotion', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const rankId = parseId(stringField(body, 'rank_id'))
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')
  const reason = stringField(body, 'reason')

  if (rankId === undefined) {
    setFlash(c, 'Choose a rank.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${memberId}`)
  }

  const db = getDb()
  const rank = await db.selectFrom('ranks').select('id').where('id', '=', rankId).executeTakeFirst()
  if (!rank) {
    setFlash(c, 'Choose a valid rank.')
    return c.redirect(`/members/${memberId}`)
  }

  await addCorePromotionEvent(db, {
    memberId,
    rankId,
    eventDate: parsed.date,
    precision: parsed.precision,
    reason: reason ?? null,
  })
  setFlash(c, 'Rank recorded.')
  return c.redirect(`/members/${memberId}`)
})

// Record an Arma 3 promotion or demotion.
rankRoutes.post('/members/:id/arma3-promotion', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const rankId = parseId(stringField(body, 'rank_id'))
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')
  const reason = stringField(body, 'reason')

  if (rankId === undefined) {
    setFlash(c, 'Choose a rank.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${memberId}`)
  }

  const db = getDb()
  const rank = await db.selectFrom('ranks').select('id').where('id', '=', rankId).executeTakeFirst()
  if (!rank) {
    setFlash(c, 'Choose a valid rank.')
    return c.redirect(`/members/${memberId}`)
  }

  await addArma3PromotionEvent(db, {
    memberId,
    rankId,
    eventDate: parsed.date,
    precision: parsed.precision,
    reason: reason ?? null,
  })
  setFlash(c, 'Arma 3 rank recorded.')
  return c.redirect(`/members/${memberId}`)
})
