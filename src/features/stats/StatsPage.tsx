import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listItems, type RoutineItem } from '../items/itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { listCompletions, type ItemCompletion } from '../completions/completionsApi'
import { buildOccurrences } from '../../lib/occurrences'
import { computeCategoryStats, computeStreak } from '../../lib/stats'
import { localDateISO, startOfMonth } from '../../lib/recurrence'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export default function StatsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [completions, setCompletions] = useState<ItemCompletion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

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
      .finally(() => setLoaded(true))
  }, [user])

  if (!user) return null

  const today = localDateISO()
  const monthStart = startOfMonth(today)
  const occurrences = buildOccurrences(items, completions, user.id, monthStart, today)
  const categoryStats = computeCategoryStats(occurrences, categories)
  const ownStreak = computeStreak(occurrences, 'own')
  const partnerStreak = computeStreak(occurrences, 'partner-shared')
  const month = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const withOccurrences = categoryStats.filter((stat) => stat.total > 0)

  return (
    <div className="stack">
      <PageHeader eyebrow={month.charAt(0).toUpperCase() + month.slice(1)} title="Estatísticas" />
      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-card__label"><Icon name="flame" /> Você</span>
          <strong className="stat-card__num">{ownStreak}</strong>
          <span className="muted">{plural(ownStreak, 'dia seguido', 'dias seguidos')}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-card__label"><Icon name="couple" /> Seu par</span>
          <strong className="stat-card__num">{partnerStreak}</strong>
          <span className="muted">
            {plural(partnerStreak, 'dia seguido nos compartilhados', 'dias seguidos nos compartilhados')}
          </span>
        </div>
      </div>
      <section className="card stack stack--tight">
        <h2 className="group-title">Por categoria</h2>
        {!loaded ? null : withOccurrences.length === 0 ? (
          <p className="empty">Ainda não há itens neste mês.</p>
        ) : (
          withOccurrences.map((stat) => {
            const pct = Math.round((stat.done / stat.total) * 100)
            return (
              <div key={stat.categoryId} className="stat-row">
                <div className="stat-row__head">
                  <span className="stat-row__name">
                    <span className="dot" style={{ background: stat.cor }} />
                    {stat.nome}
                  </span>
                  <span className="muted">{pct}% · {stat.done}/{stat.total}</span>
                </div>
                <div
                  className="progress progress--thick"
                  role="progressbar"
                  aria-label={stat.nome}
                  aria-valuemin={0}
                  aria-valuenow={stat.done}
                  aria-valuemax={stat.total}
                >
                  <span style={{ width: `${pct}%`, background: stat.cor }} />
                </div>
              </div>
            )
          })
        )}
      </section>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}
