import type { FC, PropsWithChildren } from 'hono/jsx'
import { formatEventDate } from './date'
import type { LifecycleEvent, MemberDetail, MemberStatus, MemberSummary, NicknameEvent } from './members'
import type { Role } from './role'

// Shared page shell (Bootstrap 5 via CDN).
export const Layout: FC<PropsWithChildren<{ title: string; role: Role }>> = (props) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{props.title} · Clan Management System</title>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
      />
    </head>
    <body>
      <nav class="navbar navbar-expand bg-dark" data-bs-theme="dark">
        <div class="container">
          <a class="navbar-brand" href="/">Clan Management System</a>
          <a class="nav-link text-light" href="/members">
            Members
          </a>
          <span class="navbar-text ms-auto">role: {props.role}</span>
        </div>
      </nav>
      <main class="container py-4">{props.children}</main>
    </body>
  </html>
)

// Small coloured badge for a derived membership status.
function statusBadge(status: MemberStatus) {
  const variant = status === 'active' ? 'success' : status === 'unknown' ? 'secondary' : 'danger'
  return <span class={`badge text-bg-${variant}`}>{status}</span>
}

// Render the nickname history (or a placeholder when empty).
function NicknameHistory(props: { events: NicknameEvent[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No nickname events.</p>
  }
  return (
    <ul class="list-group">
      {props.events.map((event) => (
        <li class="list-group-item">
          {event.nickname}{' '}
          <span class="text-muted">({formatEventDate(event.event_date, event.event_date_precision)})</span>
        </li>
      ))}
    </ul>
  )
}

// Render the lifecycle history (or a placeholder when empty).
function LifecycleHistory(props: { events: LifecycleEvent[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No lifecycle events.</p>
  }
  return (
    <ul class="list-group">
      {props.events.map((event) => (
        <li class="list-group-item">
          {event.type}{' '}
          <span class="text-muted">({formatEventDate(event.event_date, event.event_date_precision)})</span>
        </li>
      ))}
    </ul>
  )
}

// Members list page.
export const MemberListPage: FC<{ role: Role; members: MemberSummary[] }> = (props) => (
  <Layout title="Members" role={props.role}>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Members</h1>
      <a class="btn btn-primary" href="/members/new">
        New member
      </a>
    </div>
    {props.members.length === 0 ? (
      <p class="text-muted">No members yet.</p>
    ) : (
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nickname</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {props.members.map((member) => (
            <tr>
              <td>{member.id}</td>
              <td>{member.nickname ?? '—'}</td>
              <td>{statusBadge(member.status)}</td>
              <td>
                <a href={`/members/${member.id}`}>Open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Layout>
)

// New member form (identity + optional first nickname).
export const MemberNewPage: FC<{ role: Role; error?: string; nickname?: string; date?: string }> = (props) => (
  <Layout title="New member" role={props.role}>
    <h1 class="h3">New member</h1>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}
    <form method="post" action="/members">
      <div class="mb-3">
        <label class="form-label" for="nickname">
          Nickname (optional)
        </label>
        <input class="form-control" id="nickname" name="nickname" value={props.nickname ?? ''} />
      </div>
      <div class="mb-3">
        <label class="form-label" for="nickname_date">
          Nickname date (YYYY, YYYY-MM or YYYY-MM-DD; blank = unknown)
        </label>
        <input class="form-control" id="nickname_date" name="nickname_date" value={props.date ?? ''} />
      </div>
      <button class="btn btn-primary" type="submit">
        Create
      </button>
    </form>
  </Layout>
)

// Member detail page: projected state, history, and event forms.
export const MemberDetailPage: FC<{ role: Role; member: MemberDetail; error?: string }> = (props) => (
  <Layout title={`Member #${props.member.id}`} role={props.role}>
    <h1 class="h3">Member #{props.member.id}</h1>
    <p>
      Current nickname: <strong>{props.member.nickname ?? '—'}</strong> · Status: {statusBadge(props.member.status)}
    </p>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}

    <div class="row">
      <div class="col-md-6">
        <h2 class="h5">Add nickname</h2>
        <form method="post" action={`/members/${props.member.id}/nickname`}>
          <div class="mb-3">
            <label class="form-label" for="nickname">
              Nickname
            </label>
            <input class="form-control" id="nickname" name="nickname" />
          </div>
          <div class="mb-3">
            <label class="form-label" for="nickname_date">
              Date (blank = unknown)
            </label>
            <input class="form-control" id="nickname_date" name="event_date" />
          </div>
          <button class="btn btn-primary" type="submit">
            Add
          </button>
        </form>

        <h2 class="h5 mt-4">Nickname history</h2>
        <NicknameHistory events={props.member.nicknames} />
      </div>

      <div class="col-md-6">
        <h2 class="h5">Add lifecycle event</h2>
        <form method="post" action={`/members/${props.member.id}/lifecycle`}>
          <div class="mb-3">
            <label class="form-label" for="type">
              Type
            </label>
            <select class="form-select" id="type" name="type">
              <option value="join">join</option>
              <option value="leave">leave</option>
              <option value="kick">kick</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label" for="lifecycle_date">
              Date (blank = unknown)
            </label>
            <input class="form-control" id="lifecycle_date" name="event_date" />
          </div>
          <button class="btn btn-primary" type="submit">
            Add
          </button>
        </form>

        <h2 class="h5 mt-4">Lifecycle history</h2>
        <LifecycleHistory events={props.member.lifecycle} />
      </div>
    </div>
  </Layout>
)
