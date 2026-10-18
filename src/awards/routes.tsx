import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { setFlash } from '../lib/flash'
import { requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { grantAward, revokeAward } from './data'

// Router for award routes (mounted at the application root).
export const awardRoutes = new Hono()

// Parse a member/event id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Grant an award to a member.
awardRoutes.post('/members/:id/award', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const awardId = parseId(stringField(body, 'award_id'))
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')
  const reason = stringField(body, 'reason')

  if (awardId === undefined) {
    setFlash(c, 'Choose an award.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${memberId}`)
  }

  const error = await grantAward(getDb(), {
    memberId,
    awardId,
    eventDate: parsed.date,
    precision: parsed.precision,
    reason: reason ?? null,
  })
  setFlash(c, error ?? 'Award granted.')
  return c.redirect(`/members/${memberId}`)
})

// Revoke a specific award instance.
awardRoutes.post('/members/:id/award/revoke', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const eventId = parseId(stringField(body, 'event_id'))
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')
  const reason = stringField(body, 'reason')

  if (eventId === undefined) {
    setFlash(c, 'Choose an award to revoke.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${memberId}`)
  }

  const error = await revokeAward(getDb(), {
    memberId,
    instanceEventId: eventId,
    eventDate: parsed.date,
    precision: parsed.precision,
    reason: reason ?? null,
  })
  setFlash(c, error ?? 'Award revoked.')
  return c.redirect(`/members/${memberId}`)
})
