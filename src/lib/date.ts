import type { EventDatePrecision } from '../db/types'

// Result of parsing a partial date field.
export type ParsedDate =
  | { ok: true; date: string | null; precision: EventDatePrecision }
  | { ok: false; error: string }

// Parse a partial date string: YYYY, YYYY-MM or YYYY-MM-DD. Empty input means an unknown date.
// The canonical value is always a full 'YYYY-MM-DD' date; the precision records how much is known.
export function parsePartialDate(raw: string): ParsedDate {
  const value = raw.trim()

  // Empty input -> unknown date.
  if (value === '') {
    return { ok: true, date: null, precision: 'unknown' }
  }

  // Year precision.
  const year = /^(\d{4})$/.exec(value)
  if (year) {
    return { ok: true, date: `${year[1]}-01-01`, precision: 'year' }
  }

  // Month precision.
  const month = /^(\d{4})-(\d{2})$/.exec(value)
  if (month) {
    const monthNumber = Number(month[2])
    if (monthNumber < 1 || monthNumber > 12) {
      return { ok: false, error: 'Month must be between 01 and 12.' }
    }
    return { ok: true, date: `${month[1]}-${month[2]}-01`, precision: 'month' }
  }

  // Day precision.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (day) {
    const parsed = new Date(`${value}T00:00:00Z`)
    // Reject impossible dates like 2026-02-31 (JS would silently roll them over).
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return { ok: false, error: 'Invalid calendar date.' }
    }
    return { ok: true, date: value, precision: 'day' }
  }

  return { ok: false, error: 'Use YYYY, YYYY-MM, or YYYY-MM-DD.' }
}

// Format a canonical date for display, showing only the precision that is known.
export function formatEventDate(date: string | null, precision: EventDatePrecision): string {
  if (date === null || precision === 'unknown') {
    return 'unknown'
  }
  if (precision === 'year') {
    return date.slice(0, 4)
  }
  if (precision === 'month') {
    return date.slice(0, 7)
  }
  return date
}

// Today's date in the server-local timezone as 'YYYY-MM-DD'.
export function today(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Reject dates later than today (see DECISIONS H9).
export function isFutureDate(date: string): boolean {
  return date > today()
}

// Parse and validate an event-date form field, rejecting dates in the future.
export function parseEventDateField(raw: string): ParsedDate {
  const parsed = parsePartialDate(raw)
  if (!parsed.ok) {
    return parsed
  }
  if (parsed.date !== null && isFutureDate(parsed.date)) {
    return { ok: false, error: 'Date cannot be in the future.' }
  }
  return parsed
}
