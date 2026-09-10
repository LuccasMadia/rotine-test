import { describe, it, expect } from 'vitest'
import { buildOccurrences } from './occurrences'
import type { RoutineItem } from '../features/items/itemsApi'
import type { ItemCompletion } from '../features/completions/completionsApi'

function makeItem(overrides: Partial<RoutineItem> = {}): RoutineItem {
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
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCompletion(overrides: Partial<ItemCompletion> = {}): ItemCompletion {
  return {
    id: 'completion-1',
    routine_item_id: 'item-1',
    user_id: 'user-a',
    data: '2026-01-05',
    completed_at: '2026-01-05T20:00:00Z',
    ...overrides,
  }
}

describe('buildOccurrences', () => {
  it('marks a personal item as not completed when there is no completion row', () => {
    const item = makeItem({ is_shared: false })
    const result = buildOccurrences([item], [], 'user-a', '2026-01-05', '2026-01-05')
    expect(result).toEqual([{ item, date: '2026-01-05', ownCompletion: false, partnerCompletion: false }])
  })

  it('marks a personal item as completed when the owner has a completion row', () => {
    const item = makeItem({ is_shared: false })
    const completion = makeCompletion()
    const result = buildOccurrences([item], [completion], 'user-a', '2026-01-05', '2026-01-05')
    expect(result[0].ownCompletion).toBe(true)
    expect(result[0].partnerCompletion).toBe(false)
  })

  it('tracks own and partner completion independently on a shared item', () => {
    const item = makeItem({ is_shared: true })
    const ownCompletion = makeCompletion({ user_id: 'user-a' })
    const partnerCompletion = makeCompletion({ id: 'completion-2', user_id: 'user-b' })
    const result = buildOccurrences(
      [item],
      [ownCompletion, partnerCompletion],
      'user-a',
      '2026-01-05',
      '2026-01-05',
    )
    expect(result[0].ownCompletion).toBe(true)
    expect(result[0].partnerCompletion).toBe(true)
  })

  it('never reports partner completion on a non-shared item, even if another user_id row exists', () => {
    const item = makeItem({ is_shared: false })
    const otherCompletion = makeCompletion({ user_id: 'user-b' })
    const result = buildOccurrences([item], [otherCompletion], 'user-a', '2026-01-05', '2026-01-05')
    expect(result[0].partnerCompletion).toBe(false)
  })

  it('sorts occurrences by date then by time', () => {
    const early = makeItem({ id: 'item-early', horario: '07:00', recurrence_rule: { type: 'once' } })
    const late = makeItem({
      id: 'item-late',
      data_inicio: '2026-01-05',
      horario: '20:00',
      recurrence_rule: { type: 'once' },
    })
    const result = buildOccurrences([late, early], [], 'user-a', '2026-01-05', '2026-01-05')
    expect(result.map((o) => o.item.id)).toEqual(['item-early', 'item-late'])
  })
})
