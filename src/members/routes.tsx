import { Hono } from 'hono'
import { getDb } from '../db/client'
import { memberAccountViews, type MemberAccountView } from '../accounts/data'
import { parseEventDateField } from '../lib/date'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import {
  addLifecycleEvent,
  addNicknameEvent,
  createMember,
  getMemberDetail,
  isLifecycleType,
  listMembers,
  type MemberDetail,
} from './data'
import { MemberDetailPage, MemberListPage, MemberNewPage } from './views'

// Router for member routes (mounted at the application root).
export const memberRoutes = new Hono()

// Parse a member id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Load a member detail plus the data its page needs.
async function detailContext(
  id: number,
): Promise<{ member: MemberDetail; accounts: MemberAccountView[] } | undefined> {
  const db = getDb()
  const member = await getMemberDetail(db, id)
  if (!member) {
    return undefined
  }
  const accounts = await memberAccountViews(db, id)
  return { member, accounts }
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
  const parsed = parseEventDateField(dateRaw)

  if (!parsed.ok) {
    return c.html(<MemberNewPage role={currentRole(c)} error={parsed.error} nickname={nickname} date={dateRaw} />, 400)
  }

  const id = await createMember(getDb(), {
    nickname: nickname ?? null,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  return c.redirect(`/members/${id}`)
})

// Member detail.
memberRoutes.get('/members/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const context = await detailContext(id)
  if (!context) {
    return c.notFound()
  }
  return c.html(<MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} />)
})

// Add a nickname event to a member.
memberRoutes.post('/members/:id/nickname', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const parsed = parseEventDateField(stringField(body, 'event_date') ?? '')

  if (!nickname) {
    return c.html(
      <MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} error="Nickname is required." />,
      400,
    )
  }
  if (!parsed.ok) {
    return c.html(
      <MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} error={parsed.error} />,
      400,
    )
  }

  await addNicknameEvent(getDb(), { memberId: id, nickname, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/members/${id}`)
})

// Add a lifecycle event (join / leave / kick) to a member.
memberRoutes.post('/members/:id/lifecycle', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseEventDateField(stringField(body, 'event_date') ?? '')

  if (!isLifecycleType(type)) {
    return c.html(
      <MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} error="Choose a lifecycle type." />,
      400,
    )
  }
  if (!parsed.ok) {
    return c.html(
      <MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} error={parsed.error} />,
      400,
    )
  }

  await addLifecycleEvent(getDb(), { memberId: id, type, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/members/${id}`)
})
