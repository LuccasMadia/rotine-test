import type { RoutineItem } from '../features/items/itemsApi'

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function describeRecurrence(item: RoutineItem): string {
  const rule = item.recurrence_rule
  switch (rule.type) {
    case 'once':
      return 'Única'
    case 'daily':
      return 'Diária'
    case 'weekly': {
      const days = WEEKDAY_LABELS.filter((_, index) => rule.daysOfWeek.includes(index)).join(', ')
      return rule.interval === 1 ? `Semanal (${days})` : `A cada ${rule.interval} semanas (${days})`
    }
    case 'monthly':
      return `Mensal (dia ${rule.dayOfMonth})`
    default:
      return ''
  }
}
