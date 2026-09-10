import { describe, it, expect } from 'vitest'
import {
  getOccurrencesInRange,
  isOccurrence,
  startOfMonth,
  type RecurrenceEnd,
  type RecurrenceRule,
} from './recurrence'

const NEVER: RecurrenceEnd = { type: 'never' }

describe('recurrence: once', () => {
  const rule: RecurrenceRule = { type: 'once' }

  it('occurs only on the start date', () => {
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-01')).toBe(true)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-02')).toBe(false)
  })

  it('getOccurrencesInRange returns only the start date when in range', () => {
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
    ])
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-02', '2026-01-10')).toEqual([])
  })
})

describe('recurrence: daily', () => {
  const rule: RecurrenceRule = { type: 'daily' }

  it('occurs every day from the start date onward, never before', () => {
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2025-12-31')).toBe(false)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-01-01')).toBe(true)
    expect(isOccurrence(rule, NEVER, '2026-01-01', '2026-06-15')).toBe(true)
  })

  it('getOccurrencesInRange returns every date in range', () => {
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-01', '2026-01-01', '2026-01-03')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })
})

describe('recurrence: weekly', () => {
  it('occurs on the chosen weekdays every week when interval is 1', () => {
    const rule: RecurrenceRule = { type: 'weekly', interval: 1, daysOfWeek: [1, 3] } // Mon, Wed
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-05', '2026-01-18')).toEqual([
      '2026-01-05',
      '2026-01-07',
      '2026-01-12',
      '2026-01-14',
    ])
  })

  it('skips weeks according to the interval', () => {
    const rule: RecurrenceRule = { type: 'weekly', interval: 2, daysOfWeek: [1] } // Mon, every 2 weeks
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-05', '2026-01-26')).toEqual([
      '2026-01-05',
      '2026-01-19',
    ])
  })
})

describe('recurrence: monthly', () => {
  it('occurs on the chosen day of every month, skipping months without that day', () => {
    const rule: RecurrenceRule = { type: 'monthly', dayOfMonth: 31 }
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-03-31',
    ])
  })

  it('occurs on the same day every month when the day exists in all of them', () => {
    const rule: RecurrenceRule = { type: 'monthly', dayOfMonth: 5 }
    expect(getOccurrencesInRange(rule, NEVER, '2026-01-05', '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-05',
      '2026-02-05',
      '2026-03-05',
    ])
  })
})

describe('recurrence: end conditions', () => {
  const rule: RecurrenceRule = { type: 'daily' }

  it('stops after the end date, inclusive', () => {
    const end: RecurrenceEnd = { type: 'date', value: '2026-01-03' }
    expect(getOccurrencesInRange(rule, end, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('stops after the given number of occurrences', () => {
    const end: RecurrenceEnd = { type: 'count', value: 2 }
    expect(isOccurrence(rule, end, '2026-01-01', '2026-01-02')).toBe(true)
    expect(isOccurrence(rule, end, '2026-01-01', '2026-01-03')).toBe(false)
    expect(getOccurrencesInRange(rule, end, '2026-01-01', '2026-01-01', '2026-01-10')).toEqual([
      '2026-01-01',
      '2026-01-02',
    ])
  })
})

describe('startOfMonth', () => {
  it('returns the first day of the month for a given date', () => {
    expect(startOfMonth('2026-09-10')).toBe('2026-09-01')
    expect(startOfMonth('2026-01-31')).toBe('2026-01-01')
  })
})
