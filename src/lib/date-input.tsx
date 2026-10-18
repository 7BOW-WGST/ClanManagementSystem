import type { FC } from 'hono/jsx'

// A no-JS date input: a value field plus a precision select (day/month/year/unknown).
// The value must match the chosen precision; "unknown" clears the date.
export const DateInput: FC<{ name: string; label?: string; value?: string; precision?: string }> = (props) => (
  <div class="mb-3">
    <label class="form-label" for={`${props.name}_value`}>
      {props.label ?? 'Date'}
    </label>
    <div class="input-group">
      <input
        class="form-control"
        id={`${props.name}_value`}
        name={props.name}
        value={props.value ?? ''}
        placeholder="YYYY, YYYY-MM or YYYY-MM-DD"
      />
      <select class="form-select" name={`${props.name}_precision`}>
        <option value="day" selected={props.precision === 'day'}>
          day
        </option>
        <option value="month" selected={props.precision === 'month'}>
          month
        </option>
        <option value="year" selected={props.precision === 'year'}>
          year
        </option>
        <option value="unknown" selected={props.precision === undefined || props.precision === 'unknown'}>
          unknown
        </option>
      </select>
    </div>
  </div>
)
