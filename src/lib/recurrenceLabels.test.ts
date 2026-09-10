import { describe, it, expect } from 'vitest'
import { describeRecurrence } from './recurrenceLabels'
import type { RoutineItem } from '../features/items/itemsApi'

function makeItem(rule: RoutineItem['recurrence_rule']): RoutineItem {
  return {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-05',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: rule,
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
  }
}

describe('describeRecurrence', () => {
  it('describes a one-time item', () => {
    expect(describeRecurrence(makeItem({ type: 'once' }))).toBe('Única')
  })

  it('describes a daily item', () => {
    expect(describeRecurrence(makeItem({ type: 'daily' }))).toBe('Diária')
  })

  it('describes a weekly item with interval 1', () => {
    expect(describeRecurrence(makeItem({ type: 'weekly', interval: 1, daysOfWeek: [1, 3] }))).toBe(
      'Semanal (Seg, Qua)',
    )
  })

  it('describes a weekly item with a larger interval', () => {
    expect(describeRecurrence(makeItem({ type: 'weekly', interval: 2, daysOfWeek: [1] }))).toBe(
      'A cada 2 semanas (Seg)',
    )
  })

  it('describes a monthly item', () => {
    expect(describeRecurrence(makeItem({ type: 'monthly', dayOfMonth: 5 }))).toBe('Mensal (dia 5)')
  })
})
