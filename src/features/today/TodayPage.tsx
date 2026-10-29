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
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'

export default function TodayPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

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
    } finally {
      setLoaded(true)
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

  const total = occurrences.length
  const feitos = occurrences.filter((o) => o.ownCompletion).length
  const falta = total - feitos
  const eyebrow = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="stack">
      <PageHeader
        eyebrow={eyebrow.charAt(0).toUpperCase() + eyebrow.slice(1)}
        title="Hoje"
        action={
          <Link className="icon-btn" to="/configuracoes" aria-label="Configurações">
            <Icon name="settings" />
          </Link>
        }
      />
      {total > 0 && (
        <div className="today-progress">
          <div className="today-progress__row">
            <strong>{feitos} de {total} feitos</strong>
            <span className="muted">{falta === 0 ? 'tudo feito' : `falta ${falta}`}</span>
          </div>
          <div className="progress" role="progressbar" aria-label="Progresso de hoje" aria-valuemin={0} aria-valuenow={feitos} aria-valuemax={total}>
            <span style={{ width: `${(feitos / total) * 100}%` }} />
          </div>
        </div>
      )}
      {groups.map(({ category, occurrences: categoryOccurrences }) => (
        <section key={category.id} className="stack stack--tight">
          <h2 className="group-title">
            <span className="dot" style={{ background: category.cor }} />
            {category.nome}
          </h2>
          <ul className="list">
            {categoryOccurrences.map((occurrence) => (
              <OccurrenceRow
                key={`${occurrence.item.id}-${occurrence.date}`}
                occurrence={occurrence}
                onToggle={handleToggle}
                categoryColor={category.cor}
              />
            ))}
          </ul>
        </section>
      ))}
      {loaded && groups.length === 0 && <p className="empty">Nada programado para hoje.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <Link className="fab" to="/items/new" aria-label="Novo item">
        <Icon name="plus" />
      </Link>
    </div>
  )
}
