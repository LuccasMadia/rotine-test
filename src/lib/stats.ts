import type { Category } from '../features/categories/categoriesApi'
import type { Occurrence } from './occurrences'

export type CategoryStat = {
  categoryId: string
  nome: string
  cor: string
  done: number
  total: number
}

export function computeCategoryStats(occurrences: Occurrence[], categories: Category[]): CategoryStat[] {
  return categories
    .map((category) => {
      const categoryOccurrences = occurrences.filter(
        (occurrence) => occurrence.item.category_id === category.id,
      )
      return {
        categoryId: category.id,
        nome: category.nome,
        cor: category.cor,
        done: categoryOccurrences.filter((occurrence) => occurrence.ownCompletion).length,
        total: categoryOccurrences.length,
      }
    })
    .filter((stat) => stat.total > 0)
}

export function computeStreak(occurrences: Occurrence[], scope: 'own' | 'partner-shared'): number {
  const scoped = scope === 'partner-shared' ? occurrences.filter((o) => o.item.is_shared) : occurrences

  const byDate = new Map<string, Occurrence[]>()
  for (const occurrence of scoped) {
    const existing = byDate.get(occurrence.date) ?? []
    existing.push(occurrence)
    byDate.set(occurrence.date, existing)
  }

  const dates = [...byDate.keys()].sort().reverse()

  let streak = 0
  for (const date of dates) {
    const dayOccurrences = byDate.get(date)!
    const allDone = dayOccurrences.every((occurrence) =>
      scope === 'partner-shared' ? occurrence.partnerCompletion : occurrence.ownCompletion,
    )
    if (!allDone) break
    streak += 1
  }

  return streak
}
