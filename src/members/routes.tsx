import { Hono } from 'hono'
import { memberAccountViews, type MemberAccountView } from '../accounts/data'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { consumeFlash, setFlash } from '../lib/flash'
import { pageCount, pageParams } from '../lib/pagination'
import { currentRole, requireRole } from '../lib/role'
import { memberWarThunder, type WarThunderMembership } from '../sections/data'
import { stringField } from '../lib/validation'
import {
  addLifecycleEvent,
  addNicknameEvent,
  countMembers,
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
): Promise<{ member: MemberDetail; accounts: MemberAccountView[]; warThunder: WarThunderMembership } | undefined> {
  const db = getDb()
  const member = await getMemberDetail(db, id)
  if (!member) {
    return undefined
  }
  const [accounts, warThunder] = await Promise.all([memberAccountViews(db, id), memberWarThunder(db, id)])
  return { member, accounts, warThunder }
}

// Members list.
memberRoutes.get('/members', async (c) => {
  const { page, limit, offset } = pageParams(c)
  const db = getDb()
  const [members, total] = await Promise.all([listMembers(db, { limit, offset }), countMembers(db)])
  return c.html(
    <MemberListPage role={currentRole(c)} members={members} page={page} totalPages={pageCount(total, limit)} flash={consumeFlash(c)} />,
  )
})

// New member form.
memberRoutes.get('/members/new', requireRole('owner', 'admin'), (c) =>
  c.html(<MemberNewPage role={currentRole(c)} />),
)

// Create a member (identity + optional first nickname).
memberRoutes.post('/members', requireRole('owner', 'admin'), async (c) => {
  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const date = parseDateInput(stringField(body, 'nickname_date_precision') ?? 'unknown', stringField(body, 'nickname_date') ?? '')

  if (!date.ok) {
    return c.html(
      <MemberNewPage
        role={currentRole(c)}
        error={date.error}
        nickname={nickname}
        date={stringField(body, 'nickname_date')}
        datePrecision={stringField(body, 'nickname_date_precision')}
      />,
      400,
    )
  }

  const id = await createMember(getDb(), { nickname: nickname ?? null, eventDate: date.date, precision: date.precision })
  setFlash(c, 'Member created.')
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
  return c.html(
    <MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} warThunder={context.warThunder} flash={consumeFlash(c)} />,
  )
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
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  const rerender = (error: string) =>
    c.html(<MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} warThunder={context.warThunder} error={error} />, 400)

  if (!nickname) {
    return rerender('Nickname is required.')
  }
  if (!parsed.ok) {
    return rerender(parsed.error)
  }

  await addNicknameEvent(getDb(), { memberId: id, nickname, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Nickname added.')
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
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  const rerender = (error: string) =>
    c.html(<MemberDetailPage role={currentRole(c)} member={context.member} accounts={context.accounts} warThunder={context.warThunder} error={error} />, 400)

  if (!isLifecycleType(type)) {
    return rerender('Choose a lifecycle type.')
  }
  if (!parsed.ok) {
    return rerender(parsed.error)
  }

  await addLifecycleEvent(getDb(), { memberId: id, type, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Lifecycle event added.')
  return c.redirect(`/members/${id}`)
})
