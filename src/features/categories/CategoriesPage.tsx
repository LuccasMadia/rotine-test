import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from './categoriesApi'

const ICON_OPTIONS = ['circle', 'dumbbell', 'book', 'briefcase', 'smile', 'heart', 'star', 'home']

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#6366f1')
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
    setCor('#6366f1')
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

  return (
    <div>
      <h1>Categorias</h1>
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <span style={{ color: category.cor }}>{category.icone}</span> {category.nome}
            <button onClick={() => startEdit(category)}>Editar</button>
            <button onClick={() => handleDelete(category.id)}>Excluir</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <h2>{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
        <input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} />
        <select value={icone} onChange={(e) => setIcone(e.target.value)}>
          {ICON_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button type="submit">{editingId ? 'Salvar' : 'Adicionar'}</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancelar
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
