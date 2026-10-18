import type { FC } from 'hono/jsx'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import { squadrons, type SquadronEvent } from './data'

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
