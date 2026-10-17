import type { FC, PropsWithChildren } from 'hono/jsx'
import { formatEventDate } from './date'
import type { MemberStatus, MemberSummary, NicknameEvent } from './members'
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
