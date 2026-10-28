import { addDays, isOccurrence, type RecurrenceEnd, type RecurrenceRule } from './recurrence'

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

// Numa janela que cruza a meia-noite, um horário depois de windowEnd (ex: 23:58 com fim 00:02) é de ontem.
export function occurrenceDate(horario: string, windowEnd: string, today: string): string {
  return horario.slice(0, 5) > windowEnd ? addDays(today, -1) : today
}

export function shouldNotifyNow(
  item: NotifiableItem,
  today: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  const date = occurrenceDate(item.horario, windowEnd, today)
  if (!isOccurrence(item.recurrence_rule, item.recurrence_end, item.data_inicio, date)) return false
  return isWithinWindow(item.horario, windowStart, windowEnd)
}
