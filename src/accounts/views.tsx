import type { FC } from 'hono/jsx'
import { formatEventDate } from '../lib/date'
import { Layout } from '../lib/layout'
import type { Role } from '../lib/role'
import type { AccountDetail, AccountSummary } from './data'
import { platforms } from './data'

// Render the display-name history (or a placeholder when empty).
function NameHistory(props: { name: string; detail: AccountDetail }) {
  if (props.detail.names.length === 0) {
    return <p class="text-muted">No name events.</p>
  }
  return (
    <ul class="list-group">
      {props.detail.names.map((event) => (
        <li class="list-group-item">
          {event.name}{' '}
          <span class="text-muted">({formatEventDate(event.event_date, event.event_date_precision)})</span>
        </li>
      ))}
    </ul>
  )
}

// Accounts list page.
export const AccountListPage: FC<{ role: Role; accounts: AccountSummary[] }> = (props) => (
  <Layout title="Accounts" role={props.role}>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Accounts</h1>
      <a class="btn btn-primary" href="/accounts/new">
        New account
      </a>
    </div>
    {props.accounts.length === 0 ? (
      <p class="text-muted">No accounts yet.</p>
    ) : (
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Platform</th>
            <th>Identifier</th>
            <th>Name</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {props.accounts.map((account) => (
            <tr>
              <td>{account.id}</td>
              <td>{account.platform}</td>
              <td>{account.platform_id ?? '—'}</td>
              <td>{account.name ?? '—'}</td>
              <td>
                <a href={`/accounts/${account.id}`}>Open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Layout>
)

// New account form.
export const AccountNewPage: FC<{
  role: Role
  error?: string
  platform?: string
  platformId?: string
  name?: string
  nameDate?: string
  createdDate?: string
}> = (props) => (
  <Layout title="New account" role={props.role}>
    <h1 class="h3">New account</h1>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}
    <form method="post" action="/accounts">
      <div class="mb-3">
        <label class="form-label" for="platform">
          Platform
        </label>
        <select class="form-select" id="platform" name="platform">
          {platforms.map((platform) => (
            <option value={platform} selected={props.platform === platform}>
              {platform}
            </option>
          ))}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label" for="platform_id">
          Identifier (optional)
        </label>
        <input class="form-control" id="platform_id" name="platform_id" value={props.platformId ?? ''} />
      </div>
      <div class="mb-3">
        <label class="form-label" for="name">
          Display name (optional)
        </label>
        <input class="form-control" id="name" name="name" value={props.name ?? ''} />
      </div>
      <div class="mb-3">
        <label class="form-label" for="name_date">
          Name date (YYYY, YYYY-MM or YYYY-MM-DD; blank = unknown)
        </label>
        <input class="form-control" id="name_date" name="name_date" value={props.nameDate ?? ''} />
      </div>
      <div class="mb-3">
        <label class="form-label" for="created_date">
          Account created date (optional)
        </label>
        <input class="form-control" id="created_date" name="created_date" value={props.createdDate ?? ''} />
      </div>
      <button class="btn btn-primary" type="submit">
        Create
      </button>
    </form>
  </Layout>
)

// Account detail page: identifiers, name history, and the add-name form.
export const AccountDetailPage: FC<{ role: Role; account: AccountDetail; error?: string }> = (props) => (
  <Layout title={`Account #${props.account.id}`} role={props.role}>
    <h1 class="h3">Account #{props.account.id}</h1>
    <p>
      Platform: <strong>{props.account.platform}</strong> · Identifier:{' '}
      <strong>{props.account.platform_id ?? '—'}</strong> · Current name:{' '}
      <strong>{props.account.name ?? '—'}</strong>
    </p>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}

    <h2 class="h5">Add name</h2>
    <form method="post" action={`/accounts/${props.account.id}/name`}>
      <div class="mb-3">
        <label class="form-label" for="name">
          Name
        </label>
        <input class="form-control" id="name" name="name" />
      </div>
      <div class="mb-3">
        <label class="form-label" for="name_date">
          Date (blank = unknown)
        </label>
        <input class="form-control" id="name_date" name="event_date" />
      </div>
      <button class="btn btn-primary" type="submit">
        Add
      </button>
    </form>

    <h2 class="h5 mt-4">Name history</h2>
    <NameHistory name={props.account.name ?? ''} detail={props.account} />
  </Layout>
)
