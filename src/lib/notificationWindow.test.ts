import { describe, it, expect } from 'vitest'
import { isWithinWindow, shouldNotifyNow, type NotifiableItem } from './notificationWindow'

describe('isWithinWindow', () => {
  it('returns true when horario is inside a normal (non-wrapping) window', () => {
    expect(isWithinWindow('09:03', '09:00', '09:05')).toBe(true)
  })

  it('returns false when horario is before the window', () => {
    expect(isWithinWindow('08:59', '09:00', '09:05')).toBe(false)
  })

  it('is exclusive on windowStart and inclusive on windowEnd', () => {
    expect(isWithinWindow('09:00', '09:00', '09:05')).toBe(false)
    expect(isWithinWindow('09:05', '09:00', '09:05')).toBe(true)
  })

  it('handles a window that wraps past midnight', () => {
    expect(isWithinWindow('23:58', '23:57', '00:02')).toBe(true)
    expect(isWithinWindow('00:01', '23:57', '00:02')).toBe(true)
    expect(isWithinWindow('12:00', '23:57', '00:02')).toBe(false)
  })

  it('accepts horario with seconds and compares only HH:MM', () => {
    expect(isWithinWindow('09:03:00', '09:00', '09:05')).toBe(true)
  })
})

describe('shouldNotifyNow', () => {
  const dailyItem: NotifiableItem = {
    id: 'item-1',
    data_inicio: '2026-09-01',
    horario: '09:00',
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
  }

  it('returns true when today is an occurrence and horario is inside the window', () => {
    expect(shouldNotifyNow(dailyItem, '2026-09-10', '08:56', '09:00')).toBe(true)
  })

  it('returns false when today is an occurrence but horario is outside the window', () => {
    expect(shouldNotifyNow(dailyItem, '2026-09-10', '10:00', '10:05')).toBe(false)
  })

  it('returns false when today is not an occurrence (before data_inicio)', () => {
    expect(shouldNotifyNow(dailyItem, '2026-08-31', '08:56', '09:00')).toBe(false)
  })

  it('returns false when the recurrence has already ended', () => {
    const endedItem: NotifiableItem = {
      ...dailyItem,
      recurrence_end: { type: 'date', value: '2026-09-05' },
    }
    expect(shouldNotifyNow(endedItem, '2026-09-10', '08:56', '09:00')).toBe(false)
  })

  it("uses yesterday's occurrence for a pre-midnight horario in a window that wraps midnight", () => {
    const onceItem: NotifiableItem = {
      ...dailyItem,
      horario: '23:58',
      data_inicio: '2026-09-09',
      recurrence_rule: { type: 'once' },
    }
    expect(shouldNotifyNow(onceItem, '2026-09-10', '23:57', '00:02')).toBe(true)
  })
})
