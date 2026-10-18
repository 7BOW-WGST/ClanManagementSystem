import { Hono, type Context } from 'hono'
import { getDb } from '../db/client'
import { groupHistory, isGroupPlatform, type GroupEventRow } from '../groups/data'
import { parseDateInput } from '../lib/date'
import { consumeFlash, setFlash } from '../lib/flash'
import { pageCount, pageParams } from '../lib/pagination'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import { listMembers, type MemberSummary } from '../members/data'
import { squadronHistoryForAccount, type SquadronEvent } from '../sections/data'
import {
  accountLinkViews,
  addAccountNameEvent,
  changeRelation,
  countAccounts,
  createAccount,
  getAccountDetail,
  isPlatform,
  isRelation,
  linkAccount,
  listAccounts,
  mergeAccounts,
  platformIdTaken,
  unlinkAccount,
  type AccountDetail,
  type AccountLinkView,
  type AccountSummary,
} from './data'
import { AccountDetailPage, AccountListPage, AccountNewPage } from './views'

// Router for account routes (mounted at the application root).
export const accountRoutes = new Hono()

// Parse an account/member id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// The data the account detail page needs (links, member list, other accounts).
interface DetailContext {
  account: AccountDetail
  links: AccountLinkView[]
  members: MemberSummary[]
  others: AccountSummary[]
  squadron: SquadronEvent[]
  group: GroupEventRow[]
}

// Load the account detail context.
async function detailContext(id: number): Promise<DetailContext | undefined> {
  const db = getDb()
  const account = await getAccountDetail(db, id)
  if (!account) {
    return undefined
  }
  const [links, members, accounts, squadron] = await Promise.all([
    accountLinkViews(db, id),
    listMembers(db),
    listAccounts(db),
    squadronHistoryForAccount(db, id),
  ])
  const group = isGroupPlatform(account.platform) ? await groupHistory(db, id, account.platform) : []
  return { account, links, members, others: accounts.filter((candidate) => candidate.id !== id), squadron, group }
}

// Render the account detail page with an error (used by form handlers).
function renderDetail(c: Context, context: DetailContext, error: string) {
  return c.html(
    <AccountDetailPage
      role={currentRole(c)}
      account={context.account}
      links={context.links}
      members={context.members}
      others={context.others}
      squadron={context.squadron}
      group={context.group}
      error={error}
    />,
    400,
  )
}

// Accounts list.
accountRoutes.get('/accounts', async (c) => {
  const { page, limit, offset } = pageParams(c)
  const q = c.req.query('q')
  const db = getDb()
  const [accounts, total] = await Promise.all([listAccounts(db, { limit, offset, search: q }), countAccounts(db, q)])
  return c.html(
    <AccountListPage role={currentRole(c)} accounts={accounts} page={page} totalPages={pageCount(total, limit)} q={q} flash={consumeFlash(c)} />,
  )
})

// New account form.
accountRoutes.get('/accounts/new', requireRole('owner', 'admin'), (c) =>
  c.html(<AccountNewPage role={currentRole(c)} />),
)

// Create an account (optional identifier, name and dates).
accountRoutes.post('/accounts', requireRole('owner', 'admin'), async (c) => {
  const body = await c.req.parseBody()
  const platform = stringField(body, 'platform')
  const platformId = stringField(body, 'platform_id')
  const name = stringField(body, 'name')
  const nameDate = parseDateInput(stringField(body, 'name_date_precision') ?? 'unknown', stringField(body, 'name_date') ?? '')
  const createdDate = parseDateInput(stringField(body, 'created_date_precision') ?? 'unknown', stringField(body, 'created_date') ?? '')

  // Re-render the form with the submitted values on validation failure.
  const rerender = (error: string) =>
    c.html(
      <AccountNewPage
        role={currentRole(c)}
        error={error}
        platform={platform}
        platformId={platformId}
        name={name}
        nameDate={stringField(body, 'name_date')}
        nameDatePrecision={stringField(body, 'name_date_precision')}
        createdDate={stringField(body, 'created_date')}
        createdDatePrecision={stringField(body, 'created_date_precision')}
      />,
      400,
    )

  if (!isPlatform(platform)) {
    return rerender('Choose a platform.')
  }
  if (!nameDate.ok) {
    return rerender(nameDate.error)
  }
  if (!createdDate.ok) {
    return rerender(createdDate.error)
  }

  const db = getDb()
  if (platformId !== undefined && (await platformIdTaken(db, platform, platformId))) {
    return rerender('An account with this identifier already exists for this platform.')
  }

  const id = await createAccount(db, {
    platform,
    platformId: platformId ?? null,
    name: name ?? null,
    nameDate: nameDate.date,
    namePrecision: nameDate.precision,
    createdDate: createdDate.date,
    createdPrecision: createdDate.date === null ? null : createdDate.precision,
  })
  setFlash(c, 'Account created.')
  return c.redirect(`/accounts/${id}`)
})

// Account detail.
accountRoutes.get('/accounts/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const context = await detailContext(id)
  if (!context) {
    return c.notFound()
  }
  return c.html(
    <AccountDetailPage
      role={currentRole(c)}
      account={context.account}
      links={context.links}
      members={context.members}
      others={context.others}
      squadron={context.squadron}
      group={context.group}
      flash={consumeFlash(c)}
    />,
  )
})

// Link a member to an account.
accountRoutes.post('/accounts/:id/link', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const memberId = parseId(stringField(body, 'member_id'))
  const relationRaw = stringField(body, 'relation')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (memberId === undefined) {
    return renderDetail(c, context, 'Choose a member.')
  }
  if (!parsed.ok) {
    return renderDetail(c, context, parsed.error)
  }

  const isWarThunder = context.account.platform === 'warthunder'
  const relation = isWarThunder ? (isRelation(relationRaw) ? relationRaw : undefined) : null
  if (isWarThunder && relation === undefined) {
    return renderDetail(c, context, 'Choose a War Thunder relation.')
  }

  const error = await linkAccount(getDb(), {
    accountId: id,
    memberId,
    relation: relation ?? null,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  if (error) {
    return renderDetail(c, context, error)
  }
  setFlash(c, 'Member linked.')
  return c.redirect(`/accounts/${id}`)
})

// Change the relation of an existing member link.
accountRoutes.post('/accounts/:id/relation', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const memberId = parseId(stringField(body, 'member_id'))
  const relationRaw = stringField(body, 'relation')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (memberId === undefined) {
    return renderDetail(c, context, 'Choose a member.')
  }
  if (!isRelation(relationRaw)) {
    return renderDetail(c, context, 'Choose a War Thunder relation.')
  }
  if (!parsed.ok) {
    return renderDetail(c, context, parsed.error)
  }

  const error = await changeRelation(getDb(), {
    accountId: id,
    memberId,
    relation: relationRaw,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  if (error) {
    return renderDetail(c, context, error)
  }
  setFlash(c, 'Relation changed.')
  return c.redirect(`/accounts/${id}`)
})

// Unlink a member from an account.
accountRoutes.post('/accounts/:id/unlink', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const memberId = parseId(stringField(body, 'member_id'))
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (memberId === undefined) {
    return renderDetail(c, context, 'Choose a member.')
  }
  if (!parsed.ok) {
    return renderDetail(c, context, parsed.error)
  }

  const error = await unlinkAccount(getDb(), {
    accountId: id,
    memberId,
    eventDate: parsed.date,
    precision: parsed.precision,
  })
  if (error) {
    return renderDetail(c, context, error)
  }
  setFlash(c, 'Member unlinked.')
  return c.redirect(`/accounts/${id}`)
})

// Merge another account into this one.
accountRoutes.post('/accounts/:id/merge', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const duplicateId = parseId(stringField(body, 'duplicate_id'))
  const reason = stringField(body, 'reason')

  if (duplicateId === undefined) {
    return renderDetail(c, context, 'Choose an account to merge.')
  }

  const error = await mergeAccounts(getDb(), { canonicalId: id, duplicateId, reason: reason ?? null })
  if (error) {
    return renderDetail(c, context, error)
  }
  setFlash(c, 'Account merged.')
  return c.redirect(`/accounts/${id}`)
})

// Add a display-name event to an account.
accountRoutes.post('/accounts/:id/name', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const name = stringField(body, 'name')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (!name) {
    return renderDetail(c, context, 'Name is required.')
  }
  if (!parsed.ok) {
    return renderDetail(c, context, parsed.error)
  }

  await addAccountNameEvent(getDb(), { accountId: id, name, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Name added.')
  return c.redirect(`/accounts/${id}`)
})
