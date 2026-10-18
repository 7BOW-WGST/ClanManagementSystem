import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { setFlash } from '../lib/flash'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { addArma3SectionEvent, addSquadronEvent, addSuspension, isSquadron } from './data'

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

// Record a member's section suspension.
sectionRoutes.post('/members/:id/suspension', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const sectionId = parseId(stringField(body, 'section_id'))
  const start = parseDateInput(stringField(body, 'start_date_precision') ?? 'unknown', stringField(body, 'start_date') ?? '')
  const end = parseDateInput(stringField(body, 'end_date_precision') ?? 'unknown', stringField(body, 'end_date') ?? '')
  const reason = stringField(body, 'reason')

  if (sectionId === undefined) {
    setFlash(c, 'Choose a section.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!start.ok || start.date === null) {
    setFlash(c, start.ok ? 'Enter a start date.' : start.error)
    return c.redirect(`/members/${memberId}`)
  }
  if (!end.ok) {
    setFlash(c, end.error)
    return c.redirect(`/members/${memberId}`)
  }
  if (!reason) {
    setFlash(c, 'A reason is required.')
    return c.redirect(`/members/${memberId}`)
  }

  const error = await addSuspension(getDb(), {
    memberId,
    sectionId,
    startDate: start.date,
    startPrecision: start.precision,
    endDate: end.date,
    endPrecision: end.date === null ? null : end.precision,
    reason,
  })
  setFlash(c, error ?? 'Suspension added.')
  return c.redirect(`/members/${memberId}`)
})

// Record an Arma 3 section join/leave.
sectionRoutes.post('/members/:id/arma3-section', requireRole('owner', 'admin'), async (c) => {
  const memberId = parseId(c.req.param('id'))
  if (memberId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (type !== 'join' && type !== 'leave') {
    setFlash(c, 'Choose join or leave.')
    return c.redirect(`/members/${memberId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${memberId}`)
  }

  await addArma3SectionEvent(getDb(), { memberId, type, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Arma 3 section event added.')
  return c.redirect(`/members/${memberId}`)
})
