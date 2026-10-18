import type { FC } from 'hono/jsx'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import type { ActiveAward, AwardHistoryEntry, AwardRow } from './data'

// Member awards block: active awards, a grant form, and the full history.
export const AwardsSection: FC<{
  memberId: number
  awards: AwardRow[]
  active: ActiveAward[]
  history: AwardHistoryEntry[]
}> = (props) => (
  <div>
    <h2 class="h5 mt-4">Awards</h2>
    {props.active.length === 0 ? (
      <p class="text-muted">No awards held.</p>
    ) : (
      <ul class="list-group">
        {props.active.map((award) => (
          <li class="list-group-item d-flex align-items-center gap-2">
            <span>{award.name}</span>
            <span class="text-muted">({formatEventDate(award.eventDate, award.eventDatePrecision)})</span>
            <form
              class="ms-auto"
              method="post"
              action={`/members/${props.memberId}/award/revoke`}
              onsubmit="return confirm('Revoke this award?')"
            >
              <input type="hidden" name="event_id" value={award.eventId} />
              <button class="btn btn-sm btn-outline-danger" type="submit">
                Revoke
              </button>
            </form>
          </li>
        ))}
      </ul>
    )}

    <h3 class="h6 mt-3">Grant an award</h3>
    <form method="post" action={`/members/${props.memberId}/award`}>
      <div class="row g-3 align-items-end">
        <div class="col-md-5">
          <label class="form-label" for="award_id">
            Award
          </label>
          <select class="form-select" id="award_id" name="award_id">
            {props.awards.map((award) => (
              <option value={award.id}>{award.name}</option>
            ))}
          </select>
        </div>
        <div class="col-md-4">
          <DateInput name="event_date" />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="award_reason">
            Reason
          </label>
          <input class="form-control" id="award_reason" name="reason" />
        </div>
      </div>
      <div class="mt-2">
        <button class="btn btn-primary" type="submit">
          Grant
        </button>
      </div>
    </form>

    <h3 class="h6 mt-3">Award history</h3>
    {props.history.length === 0 ? (
      <p class="text-muted">No award events.</p>
    ) : (
      <ul class="list-group">
        {props.history.map((entry) => (
          <li class="list-group-item">
            {entry.type} · {entry.name}{' '}
            <span class="text-muted">({formatEventDate(entry.eventDate, entry.eventDatePrecision)})</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
