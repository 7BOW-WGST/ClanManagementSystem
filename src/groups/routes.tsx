import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { setFlash } from '../lib/flash'
import { requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { addGroupEvent, isGroupPlatform } from './data'

// Router for group membership routes (mounted at the application root).
export const groupRoutes = new Hono()

// Parse an account id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Record a group join/leave for an account (Discord or Steam only).
groupRoutes.post('/accounts/:id/group', requireRole('owner', 'admin'), async (c) => {
  const accountId = parseId(c.req.param('id'))
  if (accountId === undefined) {
    return c.notFound()
  }

  const db = getDb()
  const account = await db
    .selectFrom('accounts')
    .select('platform')
    .where('id', '=', accountId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!account) {
    return c.notFound()
  }
  if (!isGroupPlatform(account.platform)) {
    setFlash(c, 'This platform has no group membership.')
    return c.redirect(`/accounts/${accountId}`)
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (type !== 'join' && type !== 'leave') {
    setFlash(c, 'Choose join or leave.')
    return c.redirect(`/accounts/${accountId}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/accounts/${accountId}`)
  }

  await addGroupEvent(db, {
    accountId,
    platform: account.platform,
    type,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  setFlash(c, 'Group event added.')
  return c.redirect(`/accounts/${accountId}`)
})
