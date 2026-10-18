import type { FC } from 'hono/jsx'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import type { GroupEventRow } from './data'

// Render an account's group membership history (or a placeholder when empty).
export function GroupHistory(props: { events: GroupEventRow[] }) {
  if (props.events.length === 0) {
    return <p class="text-muted">No group events.</p>
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

// Form to record a group join/leave for an account.
export const AddGroupForm: FC<{ accountId: number }> = (props) => (
  <form method="post" action={`/accounts/${props.accountId}/group`}>
    <div class="row g-2 align-items-end">
      <div class="col-md-3">
        <label class="form-label" for="group_type">
          Type
        </label>
        <select class="form-select" id="group_type" name="type">
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
