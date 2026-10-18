import type { FC } from 'hono/jsx'
import type { MemberAccountView } from '../accounts/data'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import { Layout } from '../lib/layout'
import { Pager } from '../lib/pager'
import type { Role } from '../lib/role'
import type { WarThunderMembership } from '../sections/data'
import type { RankHistoryEntry, RankRow } from '../ranks/data'
import { RankSection } from '../ranks/views'
import type { LifecycleEvent, MemberDetail, MemberStatus, MemberSummary, NicknameEvent } from './data'

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
export const MemberListPage: FC<{ role: Role; members: MemberSummary[]; page: number; totalPages: number; flash?: string }> = (props) => (
  <Layout title="Members" role={props.role} flash={props.flash}>
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
    <Pager page={props.page} totalPages={props.totalPages} basePath="/members" />
  </Layout>
)

// New member form (identity + optional first nickname).
export const MemberNewPage: FC<{
  role: Role
  flash?: string
  error?: string
  nickname?: string
  date?: string
  datePrecision?: string
}> = (props) => (
  <Layout title="New member" role={props.role} flash={props.flash}>
    <h1 class="h3">New member</h1>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}
    <form method="post" action="/members">
      <div class="mb-3">
        <label class="form-label" for="nickname">
          Nickname (optional)
        </label>
        <input class="form-control" id="nickname" name="nickname" value={props.nickname ?? ''} />
      </div>
      <DateInput name="nickname_date" label="Nickname date" value={props.date} precision={props.datePrecision} />
      <button class="btn btn-primary" type="submit">
        Create
      </button>
    </form>
  </Layout>
)

// Member detail page: projected state, history, accounts, and event forms.
export const MemberDetailPage: FC<{
  role: Role
  member: MemberDetail
  accounts: MemberAccountView[]
  warThunder: WarThunderMembership
  coreRankName: string | null
  rankHistory: RankHistoryEntry[]
  ranks: RankRow[]
  flash?: string
  error?: string
}> = (props) => (
  <Layout title={`Member #${props.member.id}`} role={props.role} flash={props.flash}>
    <h1 class="h3">Member #{props.member.id}</h1>
    <p>
      Current nickname: <strong>{props.member.nickname ?? '—'}</strong> · Status: {statusBadge(props.member.status)}
    </p>
    {props.error ? <div class="alert alert-danger">{props.error}</div> : null}

    <h2 class="h5 mt-4">Accounts</h2>
    {props.accounts.length === 0 ? (
      <p class="text-muted">No linked accounts.</p>
    ) : (
      <ul class="list-group">
        {props.accounts.map((account) => (
          <li class="list-group-item">
            <a href={`/accounts/${account.accountId}`}>{account.platform}</a>{' '}
            <span class="text-muted">
              {account.platformId ?? '—'} · {account.name ?? '—'}
              {account.relation ? ` · ${account.relation}` : ''}
            </span>
          </li>
        ))}
      </ul>
    )}

    <h2 class="h5 mt-4">War Thunder</h2>
    <p>
      Squadron: <strong>{props.warThunder.squadron ?? '—'}</strong>
      {props.warThunder.conflict ? <span class="text-warning"> · conflict</span> : null}
    </p>

    <RankSection
      memberId={props.member.id}
      currentRankName={props.coreRankName}
      history={props.rankHistory}
      ranks={props.ranks}
    />

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
          <DateInput name="event_date" />
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
          <DateInput name="event_date" />
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
