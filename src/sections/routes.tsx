import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { setFlash } from '../lib/flash'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { addSquadronEvent, isSquadron } from './data'

// Router for section/squadron routes (mounted at the application root).
export const sectionRoutes = new Hono()

// Parse an account id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Record a squadron join/leave for an account.
sectionRoutes.post('/accounts/:id/squadron', requireRole('owner', 'admin'), async (c) => {
  const accountId = parseId(c.req.param('id'))
  if (accountId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const squadron = stringField(body, 'squadron')
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (!isSquadron(squadron)) {
    setFlash(c, 'Choose a squadron.')
    return c.redirect(`/accounts/${accountId}`)
  }
  if (type !== 'join' && type !== 'leave') {
    setFlash(c, 'Choose join or leave.')
    return c.redirect(`/accounts/${accountId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/accounts/${accountId}`)
  }

  await addSquadronEvent(getDb(), {
    accountId,
    squadron,
    type,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  setFlash(c, 'Squadron event added.')
  return c.redirect(`/accounts/${accountId}`)
})
