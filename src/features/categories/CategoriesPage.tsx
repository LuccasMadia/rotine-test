import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import Icon from '../../ui/Icon'
import PageHeader from '../../ui/PageHeader'
import { useAuth } from '../auth/AuthContext'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from './categoriesApi'

const DEFAULT_COLOR = '#22c55e'
const COLOR_PRESETS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#ec4899']
const ICON_OPTIONS = ['circle', 'dumbbell', 'book', 'briefcase', 'smile', 'heart', 'star', 'home']

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(DEFAULT_COLOR)
  const [icone, setIcone] = useState(ICON_OPTIONS[0])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      setCategories(await listCategories())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id)
    setNome(category.nome)
    setCor(category.cor)
    setIcone(category.icone)
  }

  function resetForm() {
    setEditingId(null)
    setNome('')
    setCor(DEFAULT_COLOR)
    setIcone(ICON_OPTIONS[0])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    try {
      if (editingId) {
        await updateCategory(editingId, { nome, cor, icone })
      } else {
        await createCategory(user.id, { nome, cor, icone })
      }
      resetForm()
      await loadCategories()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      'Excluir esta categoria também vai excluir todos os itens de rotina vinculados a ela. Confirmar?',
    )
    if (!confirmed) return
    setError(null)
    try {
      await deleteCategory(id)
      await loadCategories()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const colors = COLOR_PRESETS.includes(cor) ? COLOR_PRESETS : [...COLOR_PRESETS, cor]

  return (
    <div className="page">
      <PageHeader title="Categorias" backTo="/items" />
      <div className="stack">
        <ul className="list">
          {categories.map((category) => (
            <li key={category.id} className="cat-row">
              <span className="dot" style={{ background: category.cor }} />
              <span className="cat-row__name">{category.nome}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Editar ${category.nome}`}
                onClick={() => startEdit(category)}
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Excluir ${category.nome}`}
                onClick={() => handleDelete(category.id)}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
        <form className="card form" onSubmit={handleSubmit}>
          <h2 className="group-title">{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
          <label className="field">
            <span>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <fieldset className="swatches">
            <legend>Cor</legend>
            {colors.map((color) => (
              <label key={color}>
                <input
                  type="radio"
                  name="cor"
                  aria-label={color}
                  checked={cor === color}
                  onChange={() => setCor(color)}
                />
                <span style={{ '--swatch': color } as CSSProperties} />
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn--primary">
            {editingId ? 'Salvar' : 'Adicionar categoria'}
          </button>
          {editingId && (
            <button type="button" className="btn btn--text" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
