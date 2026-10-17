import { describe, expect, test } from 'bun:test'
import { formatEventDate, isFutureDate, parsePartialDate, today } from '../src/lib/date'

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
