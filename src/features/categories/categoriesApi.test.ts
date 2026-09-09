import { describe, it, expect, vi } from 'vitest'
import { createCategory, deleteCategory, listCategories, updateCategory } from './categoriesApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const order = vi.fn().mockResolvedValue({
    data: [
      { id: 'cat-1', user_id: 'user-a', nome: 'Estudos', cor: '#000', icone: 'book', created_at: '2026-01-01' },
    ],
    error: null,
  })
  const select = vi.fn().mockReturnValue({ order })

  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: 'cat-2', user_id: 'user-a', nome: 'Nova', cor: '#111', icone: 'star', created_at: '2026-01-02' },
    error: null,
  })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateSingle = vi.fn().mockResolvedValue({
    data: { id: 'cat-1', user_id: 'user-a', nome: 'Editada', cor: '#222', icone: 'heart', created_at: '2026-01-01' },
    error: null,
  })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const del = vi.fn().mockReturnValue({ eq: deleteEq })

  const from = vi.fn().mockReturnValue({ select, insert, update, delete: del })
  return { supabase: { from } }
})

describe('categoriesApi', () => {
  it('listCategories returns categories ordered by name', async () => {
    const result = await listCategories()
    expect(supabase.from).toHaveBeenCalledWith('categories')
    expect(result).toHaveLength(1)
    expect(result[0].nome).toBe('Estudos')
  })

  it('createCategory inserts a category for the given user', async () => {
    const result = await createCategory('user-a', { nome: 'Nova', cor: '#111', icone: 'star' })
    expect(result.nome).toBe('Nova')
  })

  it('updateCategory updates the category matching the id', async () => {
    const result = await updateCategory('cat-1', { nome: 'Editada', cor: '#222', icone: 'heart' })
    expect(result.nome).toBe('Editada')
  })

  it('deleteCategory removes the category matching the id', async () => {
    await expect(deleteCategory('cat-1')).resolves.toBeUndefined()
  })
})
