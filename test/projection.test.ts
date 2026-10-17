import { describe, expect, test } from 'bun:test'
import { pickEffective, type ProjectableRecord } from '../src/lib/projection'

// Build a minimal projectable record for the tests.
function record(overrides: Partial<ProjectableRecord> & { label: string }): ProjectableRecord & { label: string } {
  return {
    event_date: '2024-01-01',
    event_date_precision: 'day',
    source: 'manual',
    recorded_at: new Date('2024-01-01T00:00:00Z'),
    deleted_at: null,
    ...overrides,
  }
}

describe('pickEffective (CS1)', () => {
  test('returns undefined when there are no records', () => {
    expect(pickEffective([])).toBeUndefined()
  })

  test('picks the latest event date', () => {
    const older = record({ label: 'older', event_date: '2020-01-01' })
    const newer = record({ label: 'newer', event_date: '2025-01-01' })
    expect(pickEffective([older, newer])?.label).toBe('newer')
  })

  test('an older manual entry does not override newer reality', () => {
    const manual = record({ label: 'manual', event_date: '2020-01-01', source: 'manual' })
    const auto = record({ label: 'auto', event_date: '2025-01-01', source: 'auto' })
    expect(pickEffective([manual, auto])?.label).toBe('auto')
  })

  test('on the same date manual outranks auto', () => {
    const manual = record({ label: 'manual', source: 'manual' })
    const auto = record({ label: 'auto', source: 'auto' })
    expect(pickEffective([auto, manual])?.label).toBe('manual')
  })

  test('further ties break by later recorded_at', () => {
    const earlier = record({ label: 'earlier', recorded_at: new Date('2024-01-01T00:00:00Z') })
    const later = record({ label: 'later', recorded_at: new Date('2024-01-02T00:00:00Z') })
    expect(pickEffective([later, earlier])?.label).toBe('later')
  })

  test('excludes soft-deleted records', () => {
    const live = record({ label: 'live', event_date: '2020-01-01' })
    const deleted = record({ label: 'deleted', event_date: '2025-01-01', deleted_at: new Date('2025-01-02') })
    expect(pickEffective([live, deleted])?.label).toBe('live')
  })

  test('an unknown date never becomes current over a dated record', () => {
    const dated = record({ label: 'dated', event_date: '2020-01-01', event_date_precision: 'day' })
    const undated = record({ label: 'undated', event_date: null, event_date_precision: 'unknown' })
    expect(pickEffective([dated, undated])?.label).toBe('dated')
  })

  test('undated-only streams fall back to the latest recorded_at', () => {
    const earlier = record({ label: 'earlier', event_date: null, event_date_precision: 'unknown', recorded_at: new Date('2024-01-01T00:00:00Z') })
    const later = record({ label: 'later', event_date: null, event_date_precision: 'unknown', recorded_at: new Date('2024-02-01T00:00:00Z') })
    expect(pickEffective([earlier, later])?.label).toBe('later')
  })
})
