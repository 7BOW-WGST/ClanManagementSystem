import type { FC } from 'hono/jsx'
import { DateInput } from '../lib/date-input'
import { formatEventDate } from '../lib/date'
import type { RankHistoryEntry, RankRow } from './data'

// Member rank block: current rank, promotion/demotion form, and history.
export const RankSection: FC<{
  currentRankName: string | null
  history: RankHistoryEntry[]
  ranks: RankRow[]
  action: string
  heading: string
  editable: boolean
}> = (props) => (
  <div>
    <h3 class="h6 mt-3">{props.heading}</h3>
    <p>
      Current rank: <strong>{props.currentRankName ?? '—'}</strong>
    </p>

    {props.editable ? (
      <form method="post" action={props.action}>
        <div class="row g-3 align-items-end">
          <div class="col-md-5">
            <label class="form-label" for="rank_id">
              Rank
            </label>
            <select class="form-select" id="rank_id" name="rank_id">
              {props.ranks.map((rank) => (
                <option value={rank.id}>{rank.name}</option>
              ))}
            </select>
          </div>
          <div class="col-md-5">
            <DateInput name="event_date" />
          </div>
          <div class="col-md-2">
            <button class="btn btn-primary" type="submit">
              Record
            </button>
          </div>
        </div>
      </form>
    ) : null}

    <h3 class="h6 mt-3">Rank history</h3>
    {props.history.length === 0 ? (
      <p class="text-muted">No promotions recorded.</p>
    ) : (
      <ul class="list-group">
        {props.history.map((entry) => (
          <li class="list-group-item">
            {entry.rankName}{' '}
            <span class="text-muted">({formatEventDate(entry.event_date, entry.event_date_precision)})</span>
          </li>
        ))}
      </ul>
    )}
  </div>
)
