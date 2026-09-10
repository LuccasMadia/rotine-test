import { isOccurrence, type RecurrenceEnd, type RecurrenceRule } from './recurrence'

export type NotifiableItem = {
  id: string
  data_inicio: string
  horario: string
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

export function isWithinWindow(horario: string, windowStart: string, windowEnd: string): boolean {
  const time = horario.slice(0, 5)
  if (windowStart <= windowEnd) {
    return time > windowStart && time <= windowEnd
  }
  return time > windowStart || time <= windowEnd
}

export function shouldNotifyNow(
  item: NotifiableItem,
  today: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  if (!isOccurrence(item.recurrence_rule, item.recurrence_end, item.data_inicio, today)) return false
  return isWithinWindow(item.horario, windowStart, windowEnd)
}
