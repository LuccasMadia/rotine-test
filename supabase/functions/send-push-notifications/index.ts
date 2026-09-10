import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import webpush from 'npm:web-push@3.6.7'

// --- Motor de recorrência (copiado de src/lib/recurrence.ts — Deno não importa arquivos do frontend) ---

type RecurrenceRule =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] }
  | { type: 'monthly'; dayOfMonth: number }

type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'date'; value: string }
  | { type: 'count'; value: number }

function parseISODate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`)
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
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

function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr))
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

function getOccurrencesInRange(
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

function isOccurrence(
  rule: RecurrenceRule,
  end: RecurrenceEnd,
  startDate: string,
  checkDate: string,
): boolean {
  if (checkDate < startDate) return false
  return getOccurrencesInRange(rule, end, startDate, checkDate, checkDate).length > 0
}

function isWithinWindow(horario: string, windowStart: string, windowEnd: string): boolean {
  const time = horario.slice(0, 5)
  if (windowStart <= windowEnd) {
    return time > windowStart && time <= windowEnd
  }
  return time > windowStart || time <= windowEnd
}

// --- Janela de tempo em UTC-3 fixo ---

function localWindow(): { today: string; windowStart: string; windowEnd: string } {
  const OFFSET_MS = 3 * 60 * 60 * 1000
  const now = new Date(Date.now() - OFFSET_MS)
  const windowStartDate = new Date(now.getTime() - 5 * 60 * 1000)

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    today: now.toISOString().slice(0, 10),
    windowStart: `${pad(windowStartDate.getUTCHours())}:${pad(windowStartDate.getUTCMinutes())}`,
    windowEnd: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
  }
}

// --- Handler ---

type RoutineItemRow = {
  id: string
  user_id: string
  titulo: string
  notas: string | null
  data_inicio: string
  horario: string
  is_shared: boolean
  recurrence_rule: RecurrenceRule
  recurrence_end: RecurrenceEnd
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

  webpush.setVapidDetails('mailto:luccasmadia07@gmail.com', vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { today, windowStart, windowEnd } = localWindow()

  const { data: items, error: itemsError } = await supabase
    .from('routine_items')
    .select('id, user_id, titulo, notas, data_inicio, horario, is_shared, recurrence_rule, recurrence_end')
    .lte('data_inicio', today)

  if (itemsError) {
    return new Response(JSON.stringify({ error: itemsError.message }), { status: 500 })
  }

  let notified = 0
  let skipped = 0

  for (const item of (items ?? []) as RoutineItemRow[]) {
    const isDue =
      isOccurrence(item.recurrence_rule, item.recurrence_end, item.data_inicio, today) &&
      isWithinWindow(item.horario, windowStart, windowEnd)
    if (!isDue) continue

    const recipients = [item.user_id]
    if (item.is_shared) {
      const { data: partnerId } = await supabase.rpc('partner_id', { uid: item.user_id })
      if (partnerId) recipients.push(partnerId as string)
    }

    for (const recipientId of recipients) {
      const { data: completion } = await supabase
        .from('item_completions')
        .select('id')
        .eq('routine_item_id', item.id)
        .eq('user_id', recipientId)
        .eq('data', today)
        .maybeSingle()
      if (completion) {
        skipped += 1
        continue
      }

      const { error: logError } = await supabase
        .from('notification_log')
        .insert({ routine_item_id: item.id, user_id: recipientId, occurrence_date: today })
      if (logError) {
        skipped += 1
        continue
      }

      const { data: subscriptionRow } = await supabase
        .from('push_subscriptions')
        .select('subscription_json')
        .eq('user_id', recipientId)
        .maybeSingle()
      if (!subscriptionRow) {
        skipped += 1
        continue
      }

      try {
        await webpush.sendNotification(
          subscriptionRow.subscription_json,
          JSON.stringify({
            title: `Hora de: ${item.titulo}`,
            body: item.notas ?? '',
            itemId: item.id,
          }),
        )
        notified += 1
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('user_id', recipientId)
        }
        skipped += 1
      }
    }
  }

  return new Response(JSON.stringify({ notified, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
