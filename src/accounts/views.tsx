import type { FC } from 'hono/jsx'
import { formatEventDate } from '../lib/date'
import { Layout } from '../lib/layout'
import type { Role } from '../lib/role'
import type { MemberSummary } from '../members/data'
import type { AccountDetail, AccountLinkView, AccountSummary } from './data'
import { platforms, relations } from './data'

// Render the display-name history (or a placeholder when empty).
function NameHistory(props: { events: AccountDetail['names'] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No name events.</p>
  }
  return (
    <ul class="list-group">
      {props.events.map((event) => (
        <li class="list-group-item">
          {event.name}{' '}
          <span class="text-muted">({formatEventDate(event.event_date, event.event_date_precision)})</span>
        </li>
      ))}
    </ul>
  )
}

// Render the active member links with relation/unlink actions.
function MemberLinks(props: { account: AccountDetail; links: AccountLinkView[] }) {
  if (props.links.length === 0) {
    return <p class="text-muted">Not linked to any member.</p>
  }
  return (
    <ul class="list-group">
      {props.links.map((link) => (
        <li class="list-group-item d-flex align-items-center gap-2">
          <span>
            {link.memberNickname ?? `Member #${link.memberId}`}
            {link.relation ? <span class="text-muted"> · {link.relation}</span> : null}
          </span>
          {props.account.platform === 'warthunder' ? (
            <form class="ms-auto d-flex gap-2" method="post" action={`/accounts/${props.account.id}/relation`}>
              <input type="hidden" name="member_id" value={link.memberId} />
              <select class="form-select form-select-sm" name="relation">
                {relations.map((relation) => (
                  <option value={relation} selected={link.relation === relation}>
                    {relation}
                  </option>
                ))}
              </select>
              <button class="btn btn-sm btn-outline-secondary" type="submit">
                Change
              </button>
            </form>
          ) : null}
          <form method="post" action={`/accounts/${props.account.id}/unlink`}>
            <input type="hidden" name="member_id" value={link.memberId} />
            <button class="btn btn-sm btn-outline-danger" type="submit">
              Unlink
            </button>
          </form>
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

// Account detail page: identifiers, member links, name history, and forms.
export const AccountDetailPage: FC<{
  role: Role
  account: AccountDetail
  links: AccountLinkView[]
  members: MemberSummary[]
  others: AccountSummary[]
  error?: string
}> = (props) => (
  <Layout title={`Account #${props.account.id}`} role={props.role}>
    <h1 class="h3">Account #{props.account.id}</h1>
    <p>
      Platform: <strong>{props.account.platform}</strong> · Identifier:{' '}
      <strong>{props.account.platform_id ?? '—'}</strong> · Current name: <strong>{props.account.name ?? '—'}</strong>
    </p>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}

    <h2 class="h5">Member links</h2>
    <MemberLinks account={props.account} links={props.links} />

    <h2 class="h5 mt-4">Link a member</h2>
    <form method="post" action={`/accounts/${props.account.id}/link`}>
      <div class="mb-3">
        <label class="form-label" for="member_id">
          Member
        </label>
        <select class="form-select" id="member_id" name="member_id">
          {props.members.map((member) => (
            <option value={member.id}>{member.nickname ?? `Member #${member.id}`}</option>
          ))}
        </select>
      </div>
      {props.account.platform === 'warthunder' ? (
        <div class="mb-3">
          <label class="form-label" for="relation">
            Relation
          </label>
          <select class="form-select" id="relation" name="relation">
            {relations.map((relation) => (
              <option value={relation}>{relation}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div class="mb-3">
        <label class="form-label" for="link_date">
          Date (blank = unknown)
        </label>
        <input class="form-control" id="link_date" name="event_date" />
      </div>
      <button class="btn btn-primary" type="submit">
        Link
      </button>
    </form>

    <h2 class="h5 mt-4">Add name</h2>
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

    {props.others.length > 0 ? (
      <div>
        <h2 class="h5 mt-4">Merge another account into this one</h2>
        <form method="post" action={`/accounts/${props.account.id}/merge`}>
          <div class="mb-3">
            <label class="form-label" for="duplicate_id">
              Account to merge in
            </label>
            <select class="form-select" id="duplicate_id" name="duplicate_id">
              {props.others.map((other) => (
                <option value={other.id}>
                  #{other.id} · {other.platform} · {other.name ?? other.platform_id ?? '—'}
                </option>
              ))}
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label" for="merge_reason">
              Reason (optional)
            </label>
            <input class="form-control" id="merge_reason" name="reason" />
          </div>
          <button class="btn btn-outline-danger" type="submit">
            Merge
          </button>
        </form>
      </div>
    ) : null}

    <h2 class="h5 mt-4">Name history</h2>
    <NameHistory events={props.account.names} />
  </Layout>
)
