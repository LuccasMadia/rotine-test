import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { listCompletions, type ItemCompletion } from '../completions/completionsApi'
import { buildOccurrences } from '../../lib/occurrences'
import { computeCategoryStats, computeStreak } from '../../lib/stats'
import { localDateISO, startOfMonth } from '../../lib/recurrence'

export default function StatsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const today = localDateISO()
    const monthStart = startOfMonth(today)
    Promise.all([listItems(), listCategories(), listCompletions(monthStart, today)])
      .then(([itemsResult, categoriesResult, completionsResult]) => {
        setItems(itemsResult)
        setCategories(categoriesResult)
        setCompletions(completionsResult)
      })
      .catch((e) => setError((e as Error).message))
  }, [user])

  if (!user) return null

  const today = localDateISO()
  const monthStart = startOfMonth(today)
  const occurrences = buildOccurrences(items, completions, user.id, monthStart, today)
  const categoryStats = computeCategoryStats(occurrences, categories)
  const ownStreak = computeStreak(occurrences, 'own')
  const partnerStreak = computeStreak(occurrences, 'partner-shared')

  return (
    <div>
      <h1>Estatísticas do mês</h1>
      <nav>
        <Link to="/">Hoje</Link>
        <Link to="/agenda">Agenda</Link>
      </nav>

      <section>
        <h2>Você</h2>
        <p>Streak: {ownStreak} dia(s)</p>
        <ul>
          {categoryStats.map((stat) => (
            <li key={stat.categoryId} style={{ color: stat.cor }}>
              {stat.nome}: {stat.done}/{stat.total} (
              {stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0}%)
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Parceiro</h2>
        <p>Streak (itens compartilhados): {partnerStreak} dia(s)</p>
      </section>

      {error && <p role="alert">{error}</p>}
    </div>
  )
}
