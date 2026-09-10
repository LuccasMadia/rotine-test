import { describe, it, expect } from 'vitest'
import { computeCategoryStats, computeStreak } from './stats'
import type { Occurrence } from './occurrences'
import type { Category } from '../features/categories/categoriesApi'
import type { RoutineItem } from '../features/items/itemsApi'

function makeItem(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-01',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    item: makeItem(),
    date: '2026-01-05',
    ownCompletion: false,
    partnerCompletion: false,
    ...overrides,
  }
}

describe('computeCategoryStats', () => {
  const categories: Category[] = [
    { id: 'cat-1', user_id: 'user-a', nome: 'Treino', cor: '#22c55e', icone: 'dumbbell', created_at: '' },
    { id: 'cat-2', user_id: 'user-a', nome: 'Estudos', cor: '#3b82f6', icone: 'book', created_at: '' },
  ]

  it('computes done/total per category and omits categories with no occurrences', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ category_id: 'cat-1' }), ownCompletion: true }),
      makeOccurrence({ item: makeItem({ category_id: 'cat-1' }), ownCompletion: false }),
    ]
    const result = computeCategoryStats(occurrences, categories)
    expect(result).toEqual([{ categoryId: 'cat-1', nome: 'Treino', cor: '#22c55e', done: 1, total: 2 }])
  })
})

describe('computeStreak', () => {
  it('skips days with no occurrences without breaking the streak', () => {
    const occurrences = [
      makeOccurrence({ date: '2026-01-05', ownCompletion: true }),
      makeOccurrence({ date: '2026-01-03', ownCompletion: true }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(2)
  })

  it('breaks the streak on the most recent incomplete day', () => {
    const occurrences = [
      makeOccurrence({ date: '2026-01-05', ownCompletion: false }),
      makeOccurrence({ date: '2026-01-04', ownCompletion: true }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(0)
  })

  it('requires every occurrence on a day to be completed for it to count', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ id: 'item-a' }), date: '2026-01-05', ownCompletion: true }),
      makeOccurrence({ item: makeItem({ id: 'item-b' }), date: '2026-01-05', ownCompletion: false }),
    ]
    expect(computeStreak(occurrences, 'own')).toBe(0)
  })

  it('partner-shared scope only counts shared items using partnerCompletion', () => {
    const occurrences = [
      makeOccurrence({ item: makeItem({ is_shared: true }), date: '2026-01-05', partnerCompletion: true }),
      makeOccurrence({
        item: makeItem({ is_shared: false }),
        date: '2026-01-05',
        ownCompletion: true,
        partnerCompletion: false,
      }),
    ]
    expect(computeStreak(occurrences, 'partner-shared')).toBe(1)
  })
})
