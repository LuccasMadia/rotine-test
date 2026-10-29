import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import {
  listCompletions,
  markComplete,
  unmarkComplete,
  type ItemCompletion,
} from '../completions/completionsApi'
import { buildOccurrences, type Occurrence } from '../../lib/occurrences'
import { addDays, localDateISO, startOfWeek } from '../../lib/recurrence'
import OccurrenceRow from '../occurrences/OccurrenceRow'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shortDate(iso: string): string {
  return parseLocal(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(/\.| de/g, '')
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(localDateISO()))
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user, weekStart])

  async function loadData() {
    try {
      const weekEnd = addDays(weekStart, 6)
      const [itemsResult, categoriesResult, completionsResult] = await Promise.all([
        listItems(),
        listCategories(),
        listCompletions(weekStart, weekEnd),
      ])
      setItems(itemsResult)
      setCategories(categoriesResult)
      setCompletions(completionsResult)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleToggle(occurrence: Occurrence) {
    if (!user) return
    setError(null)
    try {
      if (occurrence.ownCompletion) {
        await unmarkComplete(occurrence.item.id, occurrence.date)
      } else {
        await markComplete(user.id, occurrence.item.id, occurrence.date)
      }
      await loadData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((category) => category.id === categoryId)?.nome ?? '—'
  }

  function categoryColor(categoryId: string): string | undefined {
    return categories.find((category) => category.id === categoryId)?.cor
  }

  if (!user) return null

  const weekEnd = addDays(weekStart, 6)
  const occurrences = buildOccurrences(items, completions, user.id, weekStart, weekEnd)
  const today = localDateISO()
  const currentWeekStart = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <div className="stack">
      <PageHeader eyebrow={`${shortDate(weekStart)} – ${shortDate(weekEnd)}`} title="Semana" />
      <div className="stack stack--tight">
        <div className="week-strip">
          <button className="icon-btn" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <Icon name="chevron-left" />
          </button>
          <div className="week-strip__days">
            {days.map((day, index) => (
              <a
                key={day}
                href={`#dia-${day}`}
                className="week-strip__day"
                aria-label={`${WEEKDAY_LABELS[index]}${index > 0 && index < 6 ? '-feira' : ''}, ${parseLocal(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`}
                aria-current={day === today ? 'date' : undefined}
              >
                <span className="week-strip__letter">{WEEKDAY_LETTERS[index]}</span>
                <span className="week-strip__num">{parseLocal(day).getDate()}</span>
              </a>
            ))}
          </div>
          <button className="icon-btn" aria-label="Próxima semana" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <Icon name="chevron-right" />
          </button>
        </div>
        {weekStart !== currentWeekStart && (
          <button className="btn btn--text" onClick={() => setWeekStart(currentWeekStart)}>
            Voltar para esta semana
          </button>
        )}
      </div>
      {days.map((day, index) => {
        const dayOccurrences = occurrences.filter((occurrence) => occurrence.date === day)
        return (
          <section key={day} id={`dia-${day}`} className="stack stack--tight">
            <h2 className="group-title">
              {WEEKDAY_LABELS[index]}, {parseLocal(day).getDate()}
              {day === today ? ' · hoje' : ''}
            </h2>
            {dayOccurrences.length === 0 ? (
              <p className="empty">Nada programado.</p>
            ) : (
              <ul className="list occurrences">
                {dayOccurrences.map((occurrence) => (
                  <OccurrenceRow
                    key={`${occurrence.item.id}-${occurrence.date}`}
                    occurrence={occurrence}
                    onToggle={handleToggle}
                    categoryName={categoryName(occurrence.item.category_id)}
                    categoryColor={categoryColor(occurrence.item.category_id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}
