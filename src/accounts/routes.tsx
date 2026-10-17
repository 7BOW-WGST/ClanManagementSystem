import { Hono } from 'hono'
import { getDb } from '../db/client'
import { parseEventDateField } from '../lib/date'
import { currentRole, requireRole } from '../lib/role'
import { stringField } from '../lib/validation'
import {
  addAccountNameEvent,
  createAccount,
  getAccountDetail,
  isPlatform,
  listAccounts,
  platformIdTaken,
} from './data'
import { AccountDetailPage, AccountListPage, AccountNewPage } from './views'

// Router for account routes (mounted at the application root).
export const accountRoutes = new Hono()

// Parse an account id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Accounts list.
accountRoutes.get('/accounts', async (c) => {
  const accounts = await listAccounts(getDb())
  return c.html(<AccountListPage role={currentRole(c)} accounts={accounts} />)
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
  const nameDateRaw = stringField(body, 'name_date') ?? ''
  const createdDateRaw = stringField(body, 'created_date') ?? ''

  // Re-render the form with the submitted values on validation failure.
  const rerender = (error: string) =>
    c.html(
      <AccountNewPage
        role={currentRole(c)}
        error={error}
        platform={platform}
        platformId={platformId}
        name={name}
        nameDate={nameDateRaw}
        createdDate={createdDateRaw}
      />,
      400,
    )

  if (!isPlatform(platform)) {
    return rerender('Choose a platform.')
  }

  const nameDate = parseEventDateField(nameDateRaw)
  if (!nameDate.ok) {
    return rerender(nameDate.error)
  }

  const createdDate = parseEventDateField(createdDateRaw)
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
  return c.redirect(`/accounts/${id}`)
})

// Account detail.
accountRoutes.get('/accounts/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const account = await getAccountDetail(getDb(), id)
  if (!account) {
    return c.notFound()
  }
  return c.html(<AccountDetailPage role={currentRole(c)} account={account} />)
})

// Add a display-name event to an account.
accountRoutes.post('/accounts/:id/name', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const account = id === undefined ? undefined : await getAccountDetail(getDb(), id)
  if (id === undefined || !account) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const name = stringField(body, 'name')
  const parsed = parseEventDateField(stringField(body, 'event_date') ?? '')

  if (!name) {
    return c.html(<AccountDetailPage role={currentRole(c)} account={account} error="Name is required." />, 400)
  }
  if (!parsed.ok) {
    return c.html(<AccountDetailPage role={currentRole(c)} account={account} error={parsed.error} />, 400)
  }

  await addAccountNameEvent(getDb(), { accountId: id, name, eventDate: parsed.date, precision: parsed.precision })
  return c.redirect(`/accounts/${id}`)
})
