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
import { localDateISO } from '../../lib/recurrence'
import OccurrenceRow from '../occurrences/OccurrenceRow'

export default function TodayPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    try {
      const today = localDateISO()
      const [itemsResult, categoriesResult, completionsResult] = await Promise.all([
        listItems(),
        listCategories(),
        listCompletions(today, today),
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

  if (!user) return null

  const today = localDateISO()
  const occurrences = buildOccurrences(items, completions, user.id, today, today)

  const groups = categories
    .map((category) => ({
      category,
      occurrences: occurrences.filter((occurrence) => occurrence.item.category_id === category.id),
    }))
    .filter((group) => group.occurrences.length > 0)

  return (
    <div>
      <h1>Hoje</h1>
      <nav>
        <Link to="/agenda">Agenda</Link>
        <Link to="/estatisticas">Estatísticas</Link>
        <Link to="/categories">Categorias</Link>
        <Link to="/items">Meus itens</Link>
        <Link to="/configuracoes">Configurações</Link>
      </nav>
      {groups.map(({ category, occurrences: categoryOccurrences }) => (
        <section key={category.id}>
          <h2 style={{ color: category.cor }}>{category.nome}</h2>
          <ul>
            {categoryOccurrences.map((occurrence) => (
              <OccurrenceRow
                key={`${occurrence.item.id}-${occurrence.date}`}
                occurrence={occurrence}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p>Nada programado para hoje.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
