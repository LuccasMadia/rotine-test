import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems, type RoutineItem } from './itemsApi'
import { listCategories, type Category } from '../categories/categoriesApi'
import { describeRecurrence } from '../../lib/recurrenceLabels'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'

export default function ItemsListPage() {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

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
    } finally {
      setLoaded(true)
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Meus itens"
        action={
          <Link className="btn-chip" to="/categories">
            <Icon name="tag" size={20} />
            Categorias
          </Link>
        }
      />
      {!loaded ? null : items.length === 0 && !error ? (
        <p className="empty">Nenhum item ainda. Crie o primeiro pelo + na tela Hoje.</p>
      ) : (
        <ul className="list">
          {items.map((item) => {
            const cat = categories.find((c) => c.id === item.category_id)
            return (
              <li key={item.id} className="item-row">
                {cat && <span className="dot" style={{ background: cat.cor }} />}
                <div className="item-row__text">
                  <p className="item-row__title">{item.titulo}</p>
                  <p className="muted">
                    {describeRecurrence(item)} · {item.horario.slice(0, 5)} · {cat?.nome ?? '—'}
                    {item.is_shared && (
                      <>
                        {' '}
                        <Icon name="couple" size={14} />
                        <span className="sr-only">compartilhado</span>
                      </>
                    )}
                  </p>
                </div>
                <Link className="icon-btn" to={`/items/${item.id}/edit`} aria-label={`Editar ${item.titulo}`}>
                  <Icon name="pencil" size={20} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > 0 && (
        <p className="muted">Para editar ou excluir, toque no lápis. Itens novos você cria na tela Hoje.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  )
}
