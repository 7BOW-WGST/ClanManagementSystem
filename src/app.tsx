import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { isFutureDate, parsePartialDate, type ParsedDate } from './date'
import { getDb } from './db'
import { createMember, listMembers } from './members'
import { sameSiteGuard } from './middleware'
import { currentRole, isRole, requireRole } from './role'
import { stringField } from './validation'
import { MemberListPage, MemberNewPage } from './views'

// Create a new Hono application/router instance
export const app = new Hono()

// Apply shared middleware to every route.
app.use('*', sameSiteGuard)

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

// Health check (no database access).
app.get('/health', (c) => c.text('ok'))

// Home redirects to the members list.
app.get('/', (c) => c.redirect('/members'))

// Dev-only role switcher: sets the role cookie read by currentRole.
app.get('/dev/role/:role', (c) => {
  if (process.env.DEV_ROLE_SELECTOR !== 'true') {
    return c.notFound()
  }
  const role = c.req.param('role')
  if (!isRole(role)) {
    return c.text('Unknown role', 400)
  }
  setCookie(c, 'role', role, { httpOnly: true, sameSite: 'Lax', path: '/' })
  return c.redirect('/members')
})

// Members list.
app.get('/members', async (c) => {
  const members = await listMembers(getDb())
  return c.html(<MemberListPage role={currentRole(c)} members={members} />)
})

// New member form.
app.get('/members/new', requireRole('owner', 'admin'), (c) =>
  c.html(<MemberNewPage role={currentRole(c)} />),
)

// Create a member (identity + optional first nickname).
app.post('/members', requireRole('owner', 'admin'), async (c) => {
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
