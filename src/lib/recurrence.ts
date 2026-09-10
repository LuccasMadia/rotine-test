export type RecurrenceRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] } // 0=domingo..6=sábado; interval em semanas
  | { type: 'monthly'; dayOfMonth: number } // 1..31

export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'date'; value: string } // ISO date (YYYY-MM-DD), inclusive
  | { type: 'count'; value: number } // número de ocorrências, contando a partir de startDate

function parseISODate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(dateStr: string, days: number): string {
  const date = parseISODate(dateStr)
  date.setUTCDate(date.getUTCDate() + days)
  return formatISODate(date)
}

function dayOfWeek(dateStr: string): number {
  return parseISODate(dateStr).getUTCDay()
}

function dayOfMonth(dateStr: string): number {
  return parseISODate(dateStr).getUTCDate()
}

export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr))
}

export function localDateISO(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

function weeksBetween(fromSunday: string, toSunday: string): number {
  const days = Math.round(
    (parseISODate(toSunday).getTime() - parseISODate(fromSunday).getTime()) / 86_400_000,
  )
  return days / 7
}

function isMatchingDate(rule: RecurrenceRule, startDate: string, dateStr: string): boolean {
  if (dateStr < startDate) return false

  switch (rule.type) {
    case 'once':
      return dateStr === startDate
    case 'daily':
      return true
    case 'weekly': {
      if (!rule.daysOfWeek.includes(dayOfWeek(dateStr))) return false
      const weeks = weeksBetween(startOfWeek(startDate), startOfWeek(dateStr))
      return weeks % rule.interval === 0
    }
    case 'monthly':
      return dayOfMonth(dateStr) === rule.dayOfMonth
    default:
      return false
  }
}

export function getOccurrencesInRange(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const result: string[] = []
  let count = 0
  let dateStr = startDate

  while (dateStr <= rangeEnd) {
    if (end.type === 'date' && dateStr > end.value) break

    if (isMatchingDate(rule, startDate, dateStr)) {
      count += 1
      if (end.type === 'count' && count > end.value) break
      if (dateStr >= rangeStart) result.push(dateStr)
    }

    dateStr = addDays(dateStr, 1)
  }

  return result
}

export function isOccurrence(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  checkDate: string,
): boolean {
  if (checkDate < startDate) return false
  return getOccurrencesInRange(rule, end, startDate, checkDate, checkDate).length > 0
}
