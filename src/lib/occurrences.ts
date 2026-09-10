import type { RoutineItem } from '../features/items/itemsApi'
import type { ItemCompletion } from '../features/completions/completionsApi'
import { getOccurrencesInRange } from './recurrence'

export type Occurrence = {
  item: RoutineItem
  date: string
  ownCompletion: boolean
  partnerCompletion: boolean
}

export function buildOccurrences(
  items: RoutineItem[],
  completions: ItemCompletion[],
  currentUserId: string,
  rangeStart: string,
  rangeEnd: string,
): Occurrence[] {
  const occurrences: Occurrence[] = []

  for (const item of items) {
    const dates = getOccurrencesInRange(
      item.recurrence_rule,
      item.recurrence_end,
      item.data_inicio,
      rangeStart,
      rangeEnd,
    )

    for (const date of dates) {
      const completionsForOccurrence = completions.filter(
        (completion) => completion.routine_item_id === item.id && completion.data === date,
      )
      occurrences.push({
        item,
        date,
        ownCompletion: completionsForOccurrence.some((completion) => completion.user_id === currentUserId),
        partnerCompletion:
          item.is_shared &&
          completionsForOccurrence.some((completion) => completion.user_id !== currentUserId),
      })
    }
  }

  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.item.horario !== b.item.horario) return a.item.horario < b.item.horario ? -1 : 1
    return 0
  })
}
