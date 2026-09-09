import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteItem, listItems, type RoutineItem } from './itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'

function describeRecurrence(item: RoutineItem): string {
  const rule = item.recurrence_rule
  switch (rule.type) {
    case 'once':
      return 'Única'
    case 'daily':
      return 'Diária'
    case 'weekly': {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .filter((_, index) => rule.daysOfWeek.includes(index))
        .join(', ')
      return rule.interval === 1 ? `Semanal (${days})` : `A cada ${rule.interval} semanas (${days})`
    }
    case 'monthly':
      return `Mensal (dia ${rule.dayOfMonth})`
    default:
      return ''
  }
}

export default function ItemsListPage() {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [itemsResult, categoriesResult] = await Promise.all([listItems(), listCategories()])
      setItems(itemsResult)
      setCategories(categoriesResult)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((category) => category.id === categoryId)?.nome ?? '—'
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Excluir este item de rotina?')
    if (!confirmed) return
    setError(null)
    try {
      await deleteItem(id)
      await loadData()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <h1>Meus itens</h1>
      <Link to="/items/new">Novo item</Link>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.titulo} — {categoryName(item.category_id)} — {item.data_inicio} {item.horario} —{' '}
            {describeRecurrence(item)}
            <Link to={`/items/${item.id}/edit`}>Editar</Link>
            <button onClick={() => handleDelete(item.id)}>Excluir</button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
