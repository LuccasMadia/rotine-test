import { describe, it, expect, vi } from 'vitest'
import { createItem, deleteItem, getItem, listItems, updateItem } from './itemsApi'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => {
  const sampleRow = {
    id: 'item-1',
    user_id: 'user-a',
    category_id: 'cat-1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-01-05',
    horario: '18:00',
    is_shared: false,
    recurrence_rule: { type: 'once' },
    recurrence_end: { type: 'never' },
    created_at: '2026-01-01T00:00:00Z',
  }

  const order = vi.fn().mockResolvedValue({ data: [sampleRow], error: null })
  const getSingle = vi.fn().mockResolvedValue({ data: sampleRow, error: null })
  const getEq = vi.fn().mockReturnValue({ single: getSingle })
  const select = vi.fn().mockReturnValue({ order, eq: getEq })

  const insertSingle = vi.fn().mockResolvedValue({
    data: { ...sampleRow, id: 'item-2', titulo: 'Novo item' },
    error: null,
  })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })

  const updateSingle = vi.fn().mockResolvedValue({
    data: { ...sampleRow, titulo: 'Editado' },
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

describe('itemsApi', () => {
  it('listItems returns items ordered by start date', async () => {
    const result = await listItems()
    expect(supabase.from).toHaveBeenCalledWith('routine_items')
    expect(result).toHaveLength(1)
    expect(result[0].titulo).toBe('Academia')
  })

  it('getItem returns the item matching the id', async () => {
    const result = await getItem('item-1')
    expect(result.titulo).toBe('Academia')
  })

  it('createItem inserts an item for the given user', async () => {
    const result = await createItem('user-a', {
      category_id: 'cat-1',
      titulo: 'Novo item',
      notas: null,
      prioridade: 'media',
      data_inicio: '2026-01-05',
      horario: '18:00',
      is_shared: false,
      recurrence_rule: { type: 'once' },
      recurrence_end: { type: 'never' },
    })
    expect(result.titulo).toBe('Novo item')
  })

  it('updateItem updates the item matching the id', async () => {
    const result = await updateItem('item-1', {
      category_id: 'cat-1',
      titulo: 'Editado',
      notas: null,
      prioridade: 'alta',
      data_inicio: '2026-01-05',
      horario: '19:00',
      is_shared: false,
      recurrence_rule: { type: 'daily' },
      recurrence_end: { type: 'never' },
    })
    expect(result.titulo).toBe('Editado')
  })

  it('deleteItem removes the item matching the id', async () => {
    await expect(deleteItem('item-1')).resolves.toBeUndefined()
  })
})
