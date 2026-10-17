import { Hono } from 'hono'
import { getDb } from '../db/client'
import { isFutureDate, parsePartialDate, type ParsedDate } from '../lib/date'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import {
  addLifecycleEvent,
  addNicknameEvent,
  createMember,
  getMemberDetail,
  isLifecycleType,
  listMembers,
} from './data'
import { MemberDetailPage, MemberListPage, MemberNewPage } from './views'

// Router for member routes (mounted at the application root).
export const memberRoutes = new Hono()

// Parse a member id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Parse and validate an event-date form field, rejecting future dates.
function parseDateField(raw: string): ParsedDate {
  const parsed = parsePartialDate(raw)
  if (!parsed.ok) {
    return parsed
  }
  if (parsed.date !== null && isFutureDate(parsed.date)) {
    return { ok: false, error: 'Date cannot be in the future.' }
  }
  return parsed
}

// Members list.
memberRoutes.get('/members', async (c) => {
  const members = await listMembers(getDb())
  return c.html(<MemberListPage role={currentRole(c)} members={members} />)
})

// New member form.
memberRoutes.get('/members/new', requireRole('owner', 'admin'), (c) =>
  c.html(<MemberNewPage role={currentRole(c)} />),
)

// Create a member (identity + optional first nickname).
memberRoutes.post('/members', requireRole('owner', 'admin'), async (c) => {
  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const dateRaw = stringField(body, 'nickname_date') ?? ''
  const parsed = parseDateField(dateRaw)

  if (!parsed.ok) {
    return c.html(<MemberNewPage role={currentRole(c)} error={parsed.error} nickname={nickname} date={dateRaw} />, 400)
  }

  const id = await createMember(getDb(), { nickname: nickname ?? null, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/members/${id}`)
})

// Member detail.
memberRoutes.get('/members/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const member = await getMemberDetail(getDb(), id)
  if (!member) {
    return c.notFound()
  }
  return c.html(<MemberDetailPage role={currentRole(c)} member={member} />)
})

// Add a nickname event to a member.
memberRoutes.post('/members/:id/nickname', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const member = id === undefined ? undefined : await getMemberDetail(getDb(), id)
  if (id === undefined || !member) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const parsed = parseDateField(stringField(body, 'event_date') ?? '')

  if (!nickname) {
    return c.html(<MemberDetailPage role={currentRole(c)} member={member} error="Nickname is required." />, 400)
  }
  if (!parsed.ok) {
    return c.html(<MemberDetailPage role={currentRole(c)} member={member} error={parsed.error} />, 400)
  }

  await addNicknameEvent(getDb(), { memberId: id, nickname, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/members/${id}`)
})

// Add a lifecycle event (join / leave / kick) to a member.
memberRoutes.post('/members/:id/lifecycle', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const member = id === undefined ? undefined : await getMemberDetail(getDb(), id)
  if (id === undefined || !member) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateField(stringField(body, 'event_date') ?? '')

  if (!isLifecycleType(type)) {
    return c.html(<MemberDetailPage role={currentRole(c)} member={member} error="Choose a lifecycle type." />, 400)
  }
  if (!parsed.ok) {
    return c.html(<MemberDetailPage role={currentRole(c)} member={member} error={parsed.error} />, 400)
  }

  await addLifecycleEvent(getDb(), { memberId: id, type, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/members/${id}`)
})
