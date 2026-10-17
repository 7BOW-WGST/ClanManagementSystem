import type { EventDatePrecision } from './types'

// Minimal shape shared by every event record used for projection.
export interface ProjectableRecord {
  event_date: string | null
  event_date_precision: EventDatePrecision
  source: string
  recorded_at: Date
  deleted_at: Date | null
}

// Narrow a record to one that is not deleted and has a usable (known) event date.
function hasUsableDate<T extends ProjectableRecord>(record: T): record is T & { event_date: string } {
  return record.deleted_at === null && record.event_date !== null && record.event_date_precision !== 'unknown'
}

// Compare two dated records using the CS1 ordering: later event date, then manual over auto,
// then later recorded_at.
function isLater(a: ProjectableRecord & { event_date: string }, b: ProjectableRecord & { event_date: string }): boolean {
  if (a.event_date !== b.event_date) {
    return a.event_date > b.event_date
  }
  const sourceA = a.source === 'manual' ? 1 : 0
  const sourceB = b.source === 'manual' ? 1 : 0
  if (sourceA !== sourceB) {
    return sourceA > sourceB
  }
  return a.recorded_at.getTime() > b.recorded_at.getTime()
}

// CS1 projection: drop deleted -> latest event_date -> same-date manual > auto -> later recorded_at.
// When no record has a usable date, fall back to the latest recorded_at (undated-only stream).
export function pickEffective<T extends ProjectableRecord>(records: T[]): T | undefined {
  const alive = records.filter((record) => record.deleted_at === null)
  if (alive.length === 0) {
    return undefined
  }

  const dated = alive.filter(hasUsableDate)
  if (dated.length > 0) {
    return dated.reduce((best, record) => (isLater(record, best) ? record : best))
  }

  return alive.reduce((best, record) => (record.recorded_at.getTime() > best.recorded_at.getTime() ? record : best))
}
