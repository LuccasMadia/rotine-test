import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

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

  if (!user) return null

  const weekEnd = addDays(weekStart, 6)
  const occurrences = buildOccurrences(items, completions, user.id, weekStart, weekEnd)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  return (
    <div>
      <h1>Agenda da semana</h1>
      <nav>
        <Link to="/">Hoje</Link>
        <Link to="/estatisticas">Estatísticas</Link>
      </nav>
      <div>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>← Semana anterior</button>
        <button onClick={() => setWeekStart(startOfWeek(localDateISO()))}>Semana atual</button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Próxima semana →</button>
      </div>
      {days.map((day, index) => {
        const dayOccurrences = occurrences.filter((occurrence) => occurrence.date === day)
        return (
          <section key={day}>
            <h2>
              {WEEKDAY_LABELS[index]} ({day})
            </h2>
            {dayOccurrences.length === 0 ? (
              <p>Nada programado.</p>
            ) : (
              <ul>
                {dayOccurrences.map((occurrence) => (
                  <OccurrenceRow
                    key={`${occurrence.item.id}-${occurrence.date}`}
                    occurrence={occurrence}
                    onToggle={handleToggle}
                    categoryName={categoryName(occurrence.item.category_id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
