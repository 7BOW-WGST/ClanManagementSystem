import { describe, expect, test } from 'bun:test'
import { formatEventDate, isFutureDate, parseDateInput, parsePartialDate, today } from '../src/lib/date'

describe('parsePartialDate', () => {
  test('empty input means an unknown date', () => {
    expect(parsePartialDate('')).toEqual({ ok: true, date: null, precision: 'unknown' })
  })

  test('year precision', () => {
    expect(parsePartialDate('2024')).toEqual({ ok: true, date: '2024-01-01', precision: 'year' })
  })

  test('month precision', () => {
    expect(parsePartialDate('2024-05')).toEqual({ ok: true, date: '2024-05-01', precision: 'month' })
  })

  test('day precision', () => {
    expect(parsePartialDate('2024-05-17')).toEqual({ ok: true, date: '2024-05-17', precision: 'day' })
  })

  test('rejects an invalid month', () => {
    expect(parsePartialDate('2024-13').ok).toBe(false)
  })

  test('rejects an impossible day', () => {
    expect(parsePartialDate('2024-02-31').ok).toBe(false)
  })

  test('rejects free-form input', () => {
    expect(parsePartialDate('17/05/2024').ok).toBe(false)
  })
})

describe('parseDateInput', () => {
  test('unknown precision clears the date', () => {
    expect(parseDateInput('unknown', 'whatever')).toEqual({ ok: true, date: null, precision: 'unknown' })
  })

  test('accepts values matching the precision', () => {
    expect(parseDateInput('year', '2024')).toEqual({ ok: true, date: '2024-01-01', precision: 'year' })
    expect(parseDateInput('month', '2024-05')).toEqual({ ok: true, date: '2024-05-01', precision: 'month' })
    expect(parseDateInput('day', '2024-05-17')).toEqual({ ok: true, date: '2024-05-17', precision: 'day' })
  })

  test('rejects a value that does not match the precision', () => {
    expect(parseDateInput('year', '2024-05').ok).toBe(false)
    expect(parseDateInput('month', '2024').ok).toBe(false)
  })

  test('rejects an empty value for a known precision', () => {
    expect(parseDateInput('day', '').ok).toBe(false)
  })

  test('rejects a future date', () => {
    expect(parseDateInput('day', '2999-01-01').ok).toBe(false)
  })
})

describe('isFutureDate', () => {
  test('today is not in the future', () => {
    expect(isFutureDate(today())).toBe(false)
  })

  test('a later date is in the future', () => {
    expect(isFutureDate('2999-12-31')).toBe(true)
  })
})

describe('formatEventDate', () => {
  test('shows only the known precision', () => {
    expect(formatEventDate('2024-05-17', 'day')).toBe('2024-05-17')
    expect(formatEventDate('2024-05-01', 'month')).toBe('2024-05')
    expect(formatEventDate('2024-01-01', 'year')).toBe('2024')
    expect(formatEventDate(null, 'unknown')).toBe('unknown')
  })
})
