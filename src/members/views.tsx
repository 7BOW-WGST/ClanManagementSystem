import type { FC } from 'hono/jsx'
import type { MemberAccountView } from '../accounts/data'
import { platforms } from '../accounts/data'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import { Layout } from '../lib/layout'
import { Pager } from '../lib/pager'
import type { Role } from '../lib/role'
import type { WarThunderMembership } from '../sections/data'
import type { RankHistoryEntry, RankRow } from '../ranks/data'
import { RankSection } from '../ranks/views'
import type { ActiveAward, AwardHistoryEntry, AwardRow } from '../awards/data'
import { AwardsSection } from '../awards/views'
import { AddArma3SectionForm, AddSuspensionForm, Arma3SectionHistory, SuspensionHistory } from '../sections/views'
import type { Arma3SectionEventRow, SectionRow, SuspensionView } from '../sections/data'
import type { LifecycleEvent, MemberDetail, MemberStatus, MemberSummary, NicknameEvent, TimelineEntry } from './data'

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
export const MemberListPage: FC<{ role: Role; members: MemberSummary[]; page: number; totalPages: number; q?: string; flash?: string }> = (props) => (
  <Layout title="Members" role={props.role} flash={props.flash}>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">Members</h1>
      <a class="btn btn-primary" href="/members/new">
        New member
      </a>
    </div>
    <form class="mb-3" method="get" action="/members">
      <div class="input-group">
        <input class="form-control" type="search" name="q" value={props.q ?? ''} placeholder="Search by nickname" />
        <button class="btn btn-outline-secondary" type="submit">
          Search
        </button>
      </div>
    </form>
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

// New member form: onboarding (identity + nickname + optional join + optional account).
export const MemberNewPage: FC<{
  role: Role
  flash?: string
  error?: string
  nickname?: string
  date?: string
  datePrecision?: string
  joinChecked?: boolean
  joinDate?: string
  joinDatePrecision?: string
  platform?: string
  platformId?: string
  accountName?: string
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

      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="join" name="join" value="1" checked={props.joinChecked} />
        <label class="form-check-label" for="join">
          Record a join
        </label>
      </div>
      <DateInput name="join_date" label="Join date" value={props.joinDate} precision={props.joinDatePrecision} />

      <h2 class="h6 mt-4">Account (optional)</h2>
      <div class="row g-3">
        <div class="col-md-4">
          <label class="form-label" for="platform">
            Platform
          </label>
          <select class="form-select" id="platform" name="platform">
            <option value="">none</option>
            {platforms.map((platform) => (
              <option value={platform} selected={props.platform === platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label" for="platform_id">
            Identifier
          </label>
          <input class="form-control" id="platform_id" name="platform_id" value={props.platformId ?? ''} />
        </div>
        <div class="col-md-4">
          <label class="form-label" for="account_name">
            Display name
          </label>
          <input class="form-control" id="account_name" name="account_name" value={props.accountName ?? ''} />
        </div>
      </div>

      <button class="btn btn-primary mt-3" type="submit">
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
  veteran: boolean
  awards: AwardRow[]
  activeAwards: ActiveAward[]
  awardHistory: AwardHistoryEntry[]
  suspensions: SuspensionView[]
  sections: SectionRow[]
  arma3Active: boolean
  arma3RankName: string | null
  arma3RankHistory: RankHistoryEntry[]
  arma3SectionHistory: Arma3SectionEventRow[]
  flash?: string
  error?: string
}> = (props) => (
  <Layout title={`Member #${props.member.id}`} role={props.role} flash={props.flash}>
    <h1 class="h3">
      Member #{props.member.id}{' '}
      <a class="btn btn-sm btn-outline-secondary ms-2" href={`/members/${props.member.id}/timeline`}>
        Timeline
      </a>
    </h1>
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
      currentRankName={props.coreRankName}
      history={props.rankHistory}
      ranks={props.ranks}
      action={`/members/${props.member.id}/promotion`}
      heading="Core rank"
    />

    <h2 class="h5 mt-4">Veteran</h2>
    <p>
      Status: <strong>{props.veteran ? 'veteran' : '—'}</strong>
    </p>
    <form method="post" action={`/members/${props.member.id}/veteran`}>
      <div class="row g-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label" for="veteran_type">
            Change
          </label>
          <select class="form-select" id="veteran_type" name="type">
            <option value="granted">granted</option>
            <option value="removed">removed</option>
          </select>
        </div>
        <div class="col-md-4">
          <DateInput name="event_date" />
        </div>
        <div class="col-md-2">
          <button class="btn btn-primary" type="submit">
            Record
          </button>
        </div>
      </div>
    </form>

    <AwardsSection
      memberId={props.member.id}
      awards={props.awards}
      active={props.activeAwards}
      history={props.awardHistory}
    />

    <h2 class="h5 mt-4">Suspensions</h2>
    <SuspensionHistory events={props.suspensions} />
    <div class="mt-3">
      <AddSuspensionForm memberId={props.member.id} sections={props.sections} />
    </div>

    <h2 class="h5 mt-4">Arma 3</h2>
    <p>
      Section: <strong>{props.arma3Active ? 'active' : '—'}</strong>
    </p>
    <Arma3SectionHistory events={props.arma3SectionHistory} />
    <div class="mt-3">
      <AddArma3SectionForm memberId={props.member.id} />
    </div>
    <RankSection
      currentRankName={props.arma3RankName}
      history={props.arma3RankHistory}
      ranks={props.ranks}
      action={`/members/${props.member.id}/arma3-promotion`}
      heading="Arma 3 rank"
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

// Route that deletes a timeline entry (per core stream).
function deletePath(kind: TimelineEntry['kind'], memberId: number, eventId: number): string {
  if (kind === 'lifecycle') {
    return `/members/${memberId}/lifecycle/${eventId}/delete`
  }
  if (kind === 'nickname') {
    return `/members/${memberId}/nickname/${eventId}/delete`
  }
  if (kind === 'rank') {
    return `/members/${memberId}/promotion/${eventId}/delete`
  }
  return `/members/${memberId}/veteran/${eventId}/delete`
}

// Member timeline with correction and soft-delete actions for the core streams.
export const MemberTimelinePage: FC<{ role: Role; memberId: number; timeline: TimelineEntry[]; flash?: string }> = (props) => (
  <Layout title={`Member #${props.memberId} timeline`} role={props.role} flash={props.flash}>
    <h1 class="h3">Timeline · Member #{props.memberId}</h1>
    <p>
      <a href={`/members/${props.memberId}`}>Back to member</a>
    </p>
    {props.timeline.length === 0 ? (
      <p class="text-muted">No events.</p>
    ) : (
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {props.timeline.map((entry) => (
            <tr>
              <td>{formatEventDate(entry.date, entry.precision)}</td>
              <td>
                <span class="text-muted">{entry.kind}</span> · {entry.label}
              </td>
              <td>
                {entry.kind === 'nickname' ? (
                  <form class="d-flex gap-2 mb-2" method="post" action={`/members/${props.memberId}/nickname/${entry.eventId}`}>
                    <input class="form-control form-control-sm" name="nickname" placeholder="correct nickname" />
                    <DateInput name="event_date" label="" />
                    <button class="btn btn-sm btn-outline-secondary" type="submit">
                      Save
                    </button>
                  </form>
                ) : null}
                {entry.kind === 'lifecycle' ? (
                  <form class="d-flex gap-2 mb-2" method="post" action={`/members/${props.memberId}/lifecycle/${entry.eventId}`}>
                    <select class="form-select form-select-sm" name="type">
                      <option value="join">join</option>
                      <option value="leave">leave</option>
                      <option value="kick">kick</option>
                    </select>
                    <DateInput name="event_date" label="" />
                    <button class="btn btn-sm btn-outline-secondary" type="submit">
                      Save
                    </button>
                  </form>
                ) : null}
                <form
                  method="post"
                  action={deletePath(entry.kind, props.memberId, entry.eventId)}
                  onsubmit="return confirm('Delete this event?')"
                >
                  <button class="btn btn-sm btn-outline-danger" type="submit">
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </Layout>
)
