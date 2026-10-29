import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ItemFormPage from './ItemFormPage'
import { deleteItem } from './itemsApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../couple/coupleApi', () => ({ getPartnerId: vi.fn().mockResolvedValue(null) }))
vi.mock('../categories/categoriesApi', () => ({
  listCategories: vi.fn().mockResolvedValue([{ id: 'c1', nome: 'Saúde', cor: '#ff0000' }]),
}))
vi.mock('./itemsApi', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  getItem: vi.fn().mockResolvedValue({
    id: 'i1',
    category_id: 'c1',
    titulo: 'Academia',
    notas: null,
    prioridade: 'media',
    data_inicio: '2026-10-01',
    horario: '07:30:00',
    is_shared: false,
    recurrence_rule: { type: 'daily' },
    recurrence_end: { type: 'never' },
  }),
}))

async function renderEdit() {
  render(
    <MemoryRouter initialEntries={['/items/i1/edit']}>
      <Routes>
        <Route path="/items/:id/edit" element={<ItemFormPage />} />
        <Route path="/items" element={<p>Lista de itens</p>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByDisplayValue('Academia')
}

describe('ItemFormPage delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes and goes back to the list when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir item' }))
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('i1'))
    expect(await screen.findByText('Lista de itens')).toBeInTheDocument()
  })

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir item' }))
    expect(deleteItem).not.toHaveBeenCalled()
  })
})
