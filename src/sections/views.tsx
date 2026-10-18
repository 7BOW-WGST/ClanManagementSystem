import type { FC } from 'hono/jsx'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import { squadrons, type Arma3SectionEventRow, type SectionRow, type SquadronEvent, type SuspensionView } from './data'

// Render an account's squadron history (or a placeholder when empty).
export function SquadronHistory(props: { events: SquadronEvent[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No squadron events.</p>
  }
  return (
    <ul class="list-group">
      {props.events.map((event) => (
        <li class="list-group-item">
          {event.squadron} <span class="text-muted">· {event.type}</span>{' '}
          <span class="text-muted">({formatEventDate(event.event_date, event.event_date_precision)})</span>
        </li>
      ))}
    </ul>
  )
}

// Form to record a squadron join/leave for an account.
export const AddSquadronForm: FC<{ accountId: number }> = (props) => (
  <form method="post" action={`/accounts/${props.accountId}/squadron`}>
    <div class="row g-2 align-items-end">
      <div class="col-md-3">
        <label class="form-label" for="squadron">
          Squadron
        </label>
        <select class="form-select" id="squadron" name="squadron">
          {squadrons.map((squadron) => (
            <option value={squadron}>{squadron}</option>
          ))}
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label" for="squadron_type">
          Type
        </label>
        <select class="form-select" id="squadron_type" name="type">
          <option value="join">join</option>
          <option value="leave">leave</option>
        </select>
      </div>
      <div class="col-md-4">
        <DateInput name="event_date" />
      </div>
      <div class="col-md-2">
        <button class="btn btn-primary" type="submit">
          Add
        </button>
      </div>
    </div>
  </form>
)

// Render a member's section suspensions (or a placeholder when empty).
export function SuspensionHistory(props: { events: SuspensionView[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No suspensions.</p>
  }
  return (
    <ul class="list-group">
      {props.events.map((suspension) => (
        <li class="list-group-item">
          {suspension.sectionName}: {formatEventDate(suspension.startDate, suspension.startDatePrecision)} →{' '}
          {suspension.endDate ? formatEventDate(suspension.endDate, suspension.endDatePrecision ?? 'day') : 'ongoing'}
          {suspension.active ? <span class="badge text-bg-warning ms-2">active</span> : null}
          <span class="text-muted"> · {suspension.scope}</span>
        </li>
      ))}
    </ul>
  )
}

// Form to record a section suspension for a member.
export const AddSuspensionForm: FC<{ memberId: number; sections: SectionRow[] }> = (props) => (
  <form method="post" action={`/members/${props.memberId}/suspension`}>
    <div class="row g-3 align-items-end">
      <div class="col-md-3">
        <label class="form-label" for="suspension_section">
          Section
        </label>
        <select class="form-select" id="suspension_section" name="section_id">
          {props.sections.map((section) => (
            <option value={section.id}>{section.name}</option>
          ))}
        </select>
      </div>
      <div class="col-md-3">
        <DateInput name="start_date" label="Start" />
      </div>
      <div class="col-md-3">
        <DateInput name="end_date" label="End (unknown = ongoing)" />
      </div>
      <div class="col-md-3">
        <label class="form-label" for="suspension_scope">
          Scope
        </label>
        <input class="form-control" id="suspension_scope" name="scope" />
      </div>
    </div>
    <div class="mt-2">
      <button class="btn btn-primary" type="submit">
        Add
      </button>
    </div>
  </form>
)

// Render a member's Arma 3 section history (or a placeholder when empty).
export function Arma3SectionHistory(props: { events: Arma3SectionEventRow[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No Arma 3 section events.</p>
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

// Form to record an Arma 3 section join/leave for a member.
export const AddArma3SectionForm: FC<{ memberId: number }> = (props) => (
  <form method="post" action={`/members/${props.memberId}/arma3-section`}>
    <div class="row g-2 align-items-end">
      <div class="col-md-3">
        <label class="form-label" for="arma3_section_type">
          Type
        </label>
        <select class="form-select" id="arma3_section_type" name="type">
          <option value="join">join</option>
          <option value="leave">leave</option>
        </select>
      </div>
      <div class="col-md-4">
        <DateInput name="event_date" />
      </div>
      <div class="col-md-2">
        <button class="btn btn-primary" type="submit">
          Add
        </button>
      </div>
    </div>
  </form>
)
